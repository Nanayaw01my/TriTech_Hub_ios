/**
 * Late fees. The phone locks on the due date; that day is free. From the next
 * day, GHS <late_fee_per_day> (Settings, default 10) is added for every extra
 * day the plan stays overdue. Fees are paid before installments (see
 * paymentController.processSuccessfulPayment) and the phone only unlocks once
 * they're cleared. Days are Ghana days (= UTC).
 */
const InstallmentPlan = require('../models/InstallmentPlan');
const Settings = require('../models/Settings');
const logger = require('./logger');

const DAY = 24 * 60 * 60 * 1000;
const dayStart = (d) => {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
};

/** Charge any late-fee days not yet charged, up to and including today. Safe to run repeatedly. */
async function applyLateFees() {
  const settings = await Settings.getSingleton().catch(() => null);
  const fee = Number(settings?.late_fee_per_day ?? 10);
  if (!(fee > 0)) return { charged: 0 };
  const today = dayStart(new Date());

  // Overdue since before today (the due day itself is free).
  const plans = await InstallmentPlan.find({
    status: { $in: ['active', 'defaulted'] },
    next_due_date: { $lt: today },
  }).select('next_due_date last_penalty_date penalty_balance');

  let charged = 0;
  for (const plan of plans) {
    let from = new Date(dayStart(plan.next_due_date).getTime() + DAY);
    if (plan.last_penalty_date) {
      const afterLast = new Date(dayStart(plan.last_penalty_date).getTime() + DAY);
      if (afterLast > from) from = afterLast;
    }
    if (from > today) continue;
    const days = Math.floor((today - from) / DAY) + 1;
    const amount = days * fee;
    await InstallmentPlan.updateOne(
      { _id: plan._id },
      { $inc: { penalty_balance: amount, penalties_total: amount }, $set: { last_penalty_date: today } }
    );
    charged++;
    logger.info('[LateFee] Plan %s: +GHS %s (%d day(s))', plan._id, amount, days);
  }
  if (charged) logger.info('[LateFee] Charged late fees on %d plan(s).', charged);
  return { charged };
}

module.exports = { applyLateFees, dayStart };
