/**
 * Plan terms: the "deposit counts as the first day/week" rule (15 weekly /
 * 119 daily payments after the deposit) is ON HOLD. Plans are 17 weekly /
 * 120 daily payments after the deposit, as before.
 *
 * If the 15/119 rule already ran on this database (plan_terms_version 2),
 * open plans on 15/119 are switched back once: amount per payment worked out
 * again for 17/120, the money already paid kept, and the schedule rebuilt from
 * the plan's start (plus any extra days given). A customer is never made to
 * look behind by this (dates move instead), so nobody is locked or charged
 * late fees because of the switch.
 */
const InstallmentPlan = require('../models/InstallmentPlan');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

const BACK = { weekly: 17, daily: 120 };
const FROM = { weekly: 15, daily: 119 };
const OPEN = ['pending', 'returned', 'approved', 'active', 'defaulted'];
const DAY = 86400000;

function addPeriod(date, frequency, n) {
  const d = new Date(date);
  if (frequency === 'daily') d.setDate(d.getDate() + n);
  else d.setDate(d.getDate() + n * 7);
  return d;
}

/** Switch one plan (mongoose doc) from 15/119 back to 17/120. */
function revertPlan(plan) {
  const f = plan.frequency;
  if (!BACK[f] || plan.total_payments !== FROM[f]) return null;
  const total = BACK[f];
  const financed = Math.max(0, (plan.total_price || 0) - (plan.down_payment || 0));
  const per = Math.ceil((financed / total) * 100) / 100;
  const oldNext = plan.next_due_date ? new Date(plan.next_due_date) : null;

  // Rebuild from the start: first payment one period after the plan started.
  const start = plan.activated_at || plan.start_date || plan.createdAt || new Date();
  const extra = (plan.extra_days_given || 0) * DAY;
  const sched = Array.from({ length: total }, (_, i) => ({
    due_date: new Date(addPeriod(start, f, i + 1).getTime() + extra), amount: per, paid: false, payment_id: null,
  }));
  const remaining = Math.max(0, plan.remaining_balance || 0);
  let made = per > 0 ? Math.floor((financed - remaining + 0.01) / per) : 0;
  made = Math.max(0, Math.min(total - 1, made));
  sched.forEach((s, i) => { s.paid = i < made; });

  let next = new Date(sched[made].due_date);
  // Never make a customer behind because of the switch.
  if (['active', 'defaulted'].includes(plan.status) && oldNext && next < oldNext && next < new Date()) {
    const delta = oldNext - next;
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
  return { plan_id: plan._id, frequency: f, new_per: per, made, next };
}

async function revertPlanTermsIfNeeded() {
  const s = await Settings.getSingleton();
  if ((s.plan_terms_version || 1) !== 2) return 0; // the 15/119 rule never ran here
  const plans = await InstallmentPlan.find({
    status: { $in: OPEN },
    $or: [{ frequency: 'weekly', total_payments: 15 }, { frequency: 'daily', total_payments: 119 }],
  });
  const done = [];
  for (const plan of plans) {
    try {
      const r = revertPlan(plan);
      if (!r) continue;
      if (['active', 'defaulted'].includes(plan.status)) {
        // Saves the plan; unlocks a phone locked by the 15/119 rule if the
        // customer is up to date on the old terms, else moves its deadline.
        await require('./planAdjust').syncPhone(plan);
      } else {
        await plan.save();
      }
      done.push(r);
    } catch (e) {
      logger.error('[plan-terms] plan %s not switched back: %s', plan._id, e.message);
    }
  }
  await Settings.updateOne({ _id: s._id }, { $set: { plan_terms_version: 3 } });
  await AuditLog.create({ action: 'settings_updated', details: { event: 'plan_terms_reverted', plans_updated: done.length }, ip_address: 'system' }).catch(() => {});
  logger.info('[plan-terms] %d plan(s) switched back to 17 weekly / 120 daily payments.', done.length);
  return done.length;
}

module.exports = { revertPlanTermsIfNeeded, revertPlan };
