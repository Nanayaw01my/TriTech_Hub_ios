/**
 * Admin corrections to a plan: cancel (void) a payment, waive late fees, give
 * extra days. Each one recalculates the plan from the money actually paid and
 * then brings the phone in line (unlock if now up to date, or set the new
 * deadline so it locks if still behind). All recorded in the audit log.
 */
const InstallmentPlan = require('../models/InstallmentPlan');
const Payment = require('../models/Payment');
const Device = require('../models/Device');
const AuditLog = require('../models/AuditLog');
const agent = require('./androidAgent');
const logger = require('./logger');

const round = (n) => Math.round(n * 100) / 100;

class AdjustError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

/** Installments covered, schedule flags and next due date, from the balance. */
function recomputeProgress(plan) {
  const financed = Math.max(0, (plan.total_price || 0) - (plan.down_payment || 0));
  const per = Number(plan.installment_amount) || 0;
  const total = plan.total_payments || 0;
  const made = per > 0 ? Math.min(total, Math.max(0, Math.floor((financed - plan.remaining_balance + 0.01) / per))) : (plan.payments_made || 0);
  plan.payments_made = made;
  const sched = plan.schedule || [];
  sched.forEach((s, i) => {
    s.paid = i < made;
    if (!s.paid) s.payment_id = null;
  });
  if (sched[made]?.due_date) plan.next_due_date = sched[made].due_date;
  plan.markModified?.('schedule');
}

/** After a change: unlock if the customer is now up to date, else set the deadline. */
async function syncPhone(plan) {
  const caughtUp = (plan.penalty_balance || 0) <= 0.009 && plan.next_due_date && new Date(plan.next_due_date) > new Date();
  if (caughtUp && plan.status === 'defaulted') plan.status = 'active';
  await plan.save();
  const device = plan.device_id ? await Device.findById(plan.device_id) : null;
  if (!device) return { caughtUp, phone: 'none' };
  try {
    if (caughtUp && device.lock_status === 'locked') {
      device.lock_status = 'unlocked';
      if (device.agent?.enrolled) await agent.unlockDevice(device, { paidUntil: agent.computePaidUntil(plan.next_due_date) });
      else await device.save();
      return { caughtUp, phone: 'unlocked' };
    }
    if (device.agent?.enrolled) await agent.setDeadline(device, plan.next_due_date);
    return { caughtUp, phone: caughtUp ? 'deadline_moved' : 'still_behind' };
  } catch (e) {
    logger.error('[adjust] phone update failed for plan %s: %s', plan._id, e.message);
    return { caughtUp, phone: 'error' };
  }
}

async function openPlan(planId) {
  const plan = await InstallmentPlan.findById(planId);
  if (!plan) throw new AdjustError('Plan not found.', 404);
  if (!['active', 'defaulted'].includes(plan.status)) {
    throw new AdjustError(`This plan is ${plan.status}; only active or overdue plans can be changed.`);
  }
  return plan;
}

const phoneNote = (r) => (r.phone === 'unlocked' ? ' The phone is being unlocked.'
  : r.phone === 'still_behind' ? ' The customer is still behind, so the phone stays (or becomes) locked.'
    : '');

/** Cancel a payment recorded by mistake. */
async function voidPayment({ paymentId, reason, user, ip }) {
  if (!reason || String(reason).trim().length < 3) throw new AdjustError('Give a reason for cancelling this payment.');
  const payment = await Payment.findById(paymentId).setOptions({ includeVoided: true });
  if (!payment) throw new AdjustError('Payment not found.', 404);
  if (payment.voided) throw new AdjustError('This payment is already cancelled.');
  if (Payment.isDeposit(payment)) {
    throw new AdjustError("A deposit can't be cancelled here (it started the plan). Contact support if a deposit was wrong.");
  }
  const plan = await openPlan(payment.installment_plan_id);

  let toFees = Number(payment.applied_penalty);
  if (!Number.isFinite(toFees)) {
    const m = String(payment.notes || '').match(/Includes GHS ([\d.]+) late fees/i);
    toFees = m ? Number(m[1]) : 0;
  }
  toFees = Math.min(toFees, payment.amount);
  const toBalance = round(payment.amount - toFees);
  const financed = Math.max(0, (plan.total_price || 0) - (plan.down_payment || 0));

  plan.remaining_balance = round(Math.min(financed, (plan.remaining_balance || 0) + toBalance));
  plan.penalty_balance = round((plan.penalty_balance || 0) + toFees);
  recomputeProgress(plan);

  payment.voided = true;
  payment.voided_at = new Date();
  payment.voided_by = user?._id || null;
  payment.void_reason = String(reason).trim().slice(0, 200);
  await payment.save();

  const r = await syncPhone(plan);
  await AuditLog.create({
    user_id: user?._id, action: 'payment_voided', ip_address: ip,
    details: { payment_id: payment._id, plan_id: plan._id, amount: payment.amount, method: payment.payment_method, reason: payment.void_reason, phone: r.phone },
  }).catch(() => {});
  const paystackNote = payment.payment_method === 'paystack'
    ? ' This was a Paystack payment: if the money must go back to the customer, refund it in your Paystack dashboard.' : '';
  return {
    message: `Payment of GHS ${payment.amount.toLocaleString()} cancelled. Balance is now GHS ${plan.remaining_balance.toLocaleString()}.${phoneNote(r)}${paystackNote}`,
    plan,
  };
}

/** Remove some or all of the late fees owed. */
async function waiveLateFees({ planId, amount, reason, user, ip }) {
  const plan = await openPlan(planId);
  const owed = round(plan.penalty_balance || 0);
  if (owed <= 0) throw new AdjustError('This customer owes no late fees.');
  const x = amount === undefined || amount === null || amount === '' ? owed : round(Number(amount));
  if (!(x > 0)) throw new AdjustError('Enter an amount to waive.');
  if (x > owed + 0.009) throw new AdjustError(`Only GHS ${owed.toLocaleString()} in late fees is owed.`);
  plan.penalty_balance = round(owed - x);
  plan.penalties_waived = round((plan.penalties_waived || 0) + x);
  const r = await syncPhone(plan);
  await AuditLog.create({
    user_id: user?._id, action: 'late_fee_waived', ip_address: ip,
    details: { plan_id: plan._id, amount: x, reason: String(reason || '').slice(0, 200), phone: r.phone },
  }).catch(() => {});
  return { message: `GHS ${x.toLocaleString()} in late fees waived.${phoneNote(r)}`, plan };
}

/** Move the next due date (and every later one) by [days]. */
async function giveExtraDays({ planId, days, reason, user, ip }) {
  const n = Math.round(Number(days));
  if (!(n >= 1 && n <= 60)) throw new AdjustError('Give between 1 and 60 days.');
  const plan = await openPlan(planId);
  const ms = n * 24 * 60 * 60 * 1000;
  (plan.schedule || []).forEach((s) => { if (!s.paid) s.due_date = new Date(new Date(s.due_date).getTime() + ms); });
  plan.markModified('schedule');
  plan.next_due_date = new Date(new Date(plan.next_due_date).getTime() + ms);
  if (plan.end_date) plan.end_date = new Date(new Date(plan.end_date).getTime() + ms);
  plan.extra_days_given = (plan.extra_days_given || 0) + n;
  // Reminders go out again for the new date.
  plan.lock_reminder_for = null;
  plan.company_reminder_for = null;
  const r = await syncPhone(plan);
  await AuditLog.create({
    user_id: user?._id, action: 'due_date_extended', ip_address: ip,
    details: { plan_id: plan._id, days: n, new_due: plan.next_due_date, reason: String(reason || '').slice(0, 200), phone: r.phone },
  }).catch(() => {});
  const d = new Date(plan.next_due_date).toLocaleDateString('en-GH', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
  return { message: `${n} extra day(s) given. Next payment is now due ${d}.${phoneNote(r)}`, plan };
}

module.exports = { voidPayment, waiveLateFees, giveExtraDays, AdjustError, recomputeProgress, syncPhone };
