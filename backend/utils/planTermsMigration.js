/**
 * One-time update of existing plans to the new terms: the deposit counts as the
 * first day/week, so weekly plans have 15 payments after the deposit (was 17)
 * and daily plans 119 (was 120). The money already paid stays; the amount per
 * payment is worked out again from the balance after the deposit.
 *
 * Customers are protected: if the new numbers would make a customer look behind
 * (because each payment is now bigger), their remaining due dates move so the
 * next payment is not earlier than before — nobody is locked or charged late
 * fees because of the change.
 */
const InstallmentPlan = require('../models/InstallmentPlan');
const Device = require('../models/Device');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const agent = require('./androidAgent');
const logger = require('./logger');

const OLD = { weekly: 17, daily: 120 };
const NEW = { weekly: 15, daily: 119 };
const OPEN = ['pending', 'returned', 'approved', 'active', 'defaulted'];

function addPeriod(date, frequency, n) {
  const d = new Date(date);
  if (frequency === 'daily') d.setDate(d.getDate() + n);
  else d.setDate(d.getDate() + n * 7);
  return d;
}

/** Recalculate one plan (mongoose doc). Returns a short summary, or null if skipped. */
function convertPlan(plan) {
  const f = plan.frequency;
  if (!NEW[f] || plan.total_payments !== OLD[f]) return null;
  const total = NEW[f];
  const financed = Math.max(0, (plan.total_price || 0) - (plan.down_payment || 0));
  const per = Math.ceil((financed / total) * 100) / 100;
  const oldNext = plan.next_due_date ? new Date(plan.next_due_date) : null;
  const oldPer = plan.installment_amount;

  // Keep the dates (same rhythm), drop the last entries, new amount.
  let sched = [...(plan.schedule || [])].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  if (sched.length < total) {
    const first = sched[0]?.due_date || addPeriod(plan.start_date || new Date(), f, 1);
    sched = Array.from({ length: total }, (_, i) => ({ due_date: addPeriod(first, f, i), amount: per, paid: false, payment_id: null }));
  }
  sched = sched.slice(0, total).map((s) => ({ due_date: s.due_date, amount: per, paid: false, payment_id: s.payment_id || null }));

  const remaining = Math.max(0, plan.remaining_balance || 0);
  let made = per > 0 ? Math.floor((financed - remaining + 0.01) / per) : 0;
  made = Math.max(0, Math.min(total - 1, made));
  sched.forEach((s, i) => { s.paid = i < made; if (!s.paid) s.payment_id = null; });

  let next = sched[made] ? new Date(sched[made].due_date) : oldNext;
  let shiftedDays = 0;
  // Never make a customer behind because of the change.
  if (['active', 'defaulted'].includes(plan.status) && oldNext && next < oldNext) {
    const delta = oldNext - next;
    shiftedDays = Math.round(delta / 86400000);
    sched.forEach((s) => { if (!s.paid) s.due_date = new Date(new Date(s.due_date).getTime() + delta); });
    next = oldNext;
  }

  plan.total_payments = total;
  plan.installment_amount = per;
  plan.payments_made = made;
  plan.schedule = sched;
  plan.markModified('schedule');
  plan.next_due_date = next;
  plan.end_date = sched[sched.length - 1].due_date;
  plan.lock_reminder_for = null;
  plan.company_reminder_for = null;
  return { plan_id: plan._id, frequency: f, old_per: oldPer, new_per: per, made, shifted_days: shiftedDays };
}

async function migratePlanTermsV2() {
  const s = await Settings.getSingleton();
  if ((s.plan_terms_version || 1) >= 2) return 0;
  const plans = await InstallmentPlan.find({
    status: { $in: OPEN },
    $or: [{ frequency: 'weekly', total_payments: 17 }, { frequency: 'daily', total_payments: 120 }],
  });
  const done = [];
  for (const plan of plans) {
    try {
      const r = convertPlan(plan);
      if (!r) continue;
      await plan.save();
      done.push(r);
      // Keep the phone's own deadline in step with the (possibly moved) next due date.
      if (['active', 'defaulted'].includes(plan.status) && plan.device_id) {
        const dev = await Device.findById(plan.device_id);
        if (dev?.agent?.enrolled) await agent.setDeadline(dev, plan.next_due_date).catch(() => {});
      }
    } catch (e) {
      logger.error('[plan-terms] plan %s not updated: %s', plan._id, e.message);
    }
  }
  await Settings.updateOne({ _id: s._id }, { $set: { plan_terms_version: 2 } });
  await AuditLog.create({ action: 'settings_updated', details: { event: 'plan_terms_v2', plans_updated: done.length, plans: done.slice(0, 200) }, ip_address: 'system' }).catch(() => {});
  logger.info('[plan-terms] %d existing plan(s) updated to deposit + %d weekly / %d daily payments.', done.length, NEW.weekly, NEW.daily);
  return done.length;
}

module.exports = { migratePlanTermsV2, convertPlan };
