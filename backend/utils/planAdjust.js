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

/**
 * Undo a whole sale: the customer gives the phone back and gets their money
 * back. Every payment of the plan (deposit included) is cancelled, so it leaves
 * every total, report, cash-up, commission and the API (kept only in the audit
 * log). The plan is cancelled and the phone goes back to stock ("Awaiting
 * Activation"). Optionally the customer is also removed from the lists.
 */
async function refundSale({ customerId, reason, removeCustomer, user, ip }) {
  const Customer = require('../models/Customer');
  const User = require('../models/User');
  if (!reason || String(reason).trim().length < 3) throw new AdjustError('Give a reason (e.g. customer returned the phone).');
  const why = String(reason).trim().slice(0, 200);
  const customer = await Customer.findById(customerId);
  if (!customer || customer.deleted_at) throw new AdjustError('Customer not found.', 404);
  const plan = await InstallmentPlan.findOne({ customer_id: customer._id, status: { $in: ['active', 'defaulted', 'repossessed'] } })
    .sort({ createdAt: -1 });
  if (!plan) {
    throw new AdjustError('This customer has no started sale to refund. (If the deposit was never paid, use "Delete customer".)');
  }

  // Cancel every payment of this sale.
  const payments = await Payment.find({ installment_plan_id: plan._id });
  let total = 0; let paystack = 0;
  const now = new Date();
  for (const p of payments) {
    p.voided = true;
    p.voided_at = now;
    p.voided_by = user?._id || null;
    p.void_reason = `Refund & take back: ${why}`.slice(0, 200);
    await p.save();
    total += p.amount || 0;
    if (p.payment_method === 'paystack') paystack += p.amount || 0;
  }
  total = round(total); paystack = round(paystack);

  // Close the sale (not counted as a sale or for commission any more).
  const statusBefore = plan.status;
  plan.status = 'cancelled';
  plan.closed_at = now;
  plan.close_reason = 'refunded';
  plan.written_off = 0;
  plan.refunded_total = total;
  await plan.save();

  // Phone back to stock.
  let phone = 'none';
  const device = plan.device_id ? await Device.findById(plan.device_id) : null;
  if (device && (!device.assigned_to || String(device.assigned_to) === String(customer._id))) {
    device.assigned_to = null;
    device.held_by = null;
    device.held_since = null;
    device.sold_status = 'available';
    device.lock_status = 'unlocked';
    if (!device.agent) device.agent = {};
    device.agent.desired_lock_state = 'pending_activation';
    device.agent.paid_until = null;
    await device.save();
    phone = 'stock';
    if (device.agent?.enrolled) {
      try { await agent.pushCommand(device); } catch { /* applies on next check-in */ }
    }
  }

  if (removeCustomer) {
    await Customer.updateOne({ _id: customer._id }, { $set: { deleted_at: now } });
    if (customer.user_id) await User.findByIdAndUpdate(customer.user_id, { is_active: false });
  }

  await AuditLog.create({
    user_id: user?._id, action: 'sale_refunded', ip_address: ip, target_user_id: customer.user_id || undefined,
    details: {
      customer_id: customer._id, customer_name: customer.full_name, plan_id: plan._id, status_before: statusBefore,
      reason: why, payments_cancelled: payments.length, amount: total, paystack_amount: paystack,
      device_id: device?._id || null, device_model: device?.model || null, imei: device?.imei || null,
      phone, customer_removed: !!removeCustomer,
    },
  }).catch(() => {});

  const parts = [`Sale refunded: ${payments.length} payment(s), GHS ${total.toLocaleString()} taken off your records.`];
  parts.push(phone === 'stock' ? ' The phone is back in stock (it shows "Awaiting Activation" until sold again).' : '');
  if (removeCustomer) parts.push(' The customer was removed from your lists.');
  if (paystack > 0) parts.push(` GHS ${paystack.toLocaleString()} was paid through Paystack: to send that back, refund it in your Paystack dashboard.`);
  return { message: parts.join(''), plan, total, paystack };
}

module.exports = { voidPayment, waiveLateFees, giveExtraDays, refundSale, AdjustError, recomputeProgress, syncPhone };
