/**
 * Starting a sale's installment plan, and the Paystack deposit that triggers it.
 *
 * Flow: DSR registers (plan 'pending') → admin approves ('approved') → DSR
 * collects the deposit via Paystack → recordDeposit() confirms it and calls
 * activatePlanNow(), which starts the schedule and lifts the phone's
 * "Awaiting Activation" page.
 */
const InstallmentPlan = require('../models/InstallmentPlan');
const Device = require('../models/Device');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const agent = require('./androidAgent');
const logger = require('./logger');
const User = require('../models/User');
const { sendSMS, sendPaymentReminderSMS } = require('./sms');

const addPeriod = (date, frequency, n) => {
  const d = new Date(date);
  if (frequency === 'daily') d.setDate(d.getDate() + n);
  else if (frequency === 'weekly') d.setDate(d.getDate() + n * 7);
  else d.setMonth(d.getMonth() + n);
  return d;
};

const buildSchedule = (startDate, frequency, totalPayments, amount) => {
  const schedule = [];
  for (let i = 0; i < totalPayments; i++) {
    schedule.push({ due_date: addPeriod(startDate, frequency, i), amount, paid: false, payment_id: null });
  }
  return schedule;
};

/**
 * Start the plan today: rebuild the schedule, mark it active and arm the
 * phone (lifts "Awaiting Activation", sets the offline deadline).
 * [plan] is a mongoose document.
 */
async function activatePlanNow(plan, { userId = null, ip = null } = {}) {
  const startDate = new Date();
  const schedule = buildSchedule(startDate, plan.frequency, plan.total_payments, plan.installment_amount);
  // Installments already paid before activation count toward the schedule.
  const alreadyPaid = Math.min(plan.payments_made || 0, schedule.length);
  for (let i = 0; i < alreadyPaid; i++) schedule[i].paid = true;
  const firstUnpaid = schedule.find((s) => !s.paid);
  const nextDueDate = (firstUnpaid || schedule[schedule.length - 1]).due_date;

  plan.start_date = startDate;
  plan.next_due_date = nextDueDate;
  plan.end_date = schedule[schedule.length - 1].due_date;
  plan.schedule = schedule;
  plan.status = 'active';
  plan.activated_at = startDate;
  await plan.save();

  let deadlineResult = null;
  try {
    const device = await Device.findById(plan.device_id);
    if (device) {
      device.assigned_to = plan.customer_id;
      device.sold_status = 'sold';
      if (device.agent?.enrolled) deadlineResult = await agent.setDeadline(device, nextDueDate);
      else await device.save();
    }
  } catch (err) {
    logger.error('[activate] setDeadline failed for plan %s: %s', plan._id, err.message);
  }

  await AuditLog.create({
    user_id: userId,
    action: 'plan_activated',
    details: {
      plan_id: plan._id,
      customer_id: plan.customer_id,
      device_id: plan.device_id,
      next_due_date: nextDueDate,
      paid_until: deadlineResult?.paid_until || null,
    },
    ip_address: ip,
  }).catch((err) => logger.warn('[activate] audit failed: %s', err.message));

  // Tell the customer their plan is running (fire-and-forget).
  ;(async () => {
    try {
      const customer = await Customer.findById(plan.customer_id).select('full_name phone');
      if (customer?.phone) {
        await sendPaymentReminderSMS(customer.phone, customer.full_name, {
          deviceModel: '', installmentAmount: plan.installment_amount,
          remainingBalance: plan.remaining_balance, nextDueDate, isOverdue: false,
        }).catch(() => {});
      }
    } catch { /* ignore */ }
  })();

  return { nextDueDate };
}

/**
 * Record a successful Paystack DEPOSIT and activate the plan. Safe to call
 * from both the DSR's verify request and the Paystack webhook: only one of
 * them can claim the plan, the other sees a duplicate.
 *
 * Returns { ok, duplicate?, activated?, message }.
 */
async function recordDeposit(paystackData, { recordedBy = null, ip = null } = {}) {
  const reference = paystackData.reference;
  const metadata = paystackData.metadata || {};
  const planId = metadata.plan_id;
  if (!planId) return { ok: false, message: 'Payment is not linked to a sale.' };
  if (paystackData.status !== 'success') return { ok: false, message: `Payment status: ${paystackData.status}` };

  if (await Payment.findOne({ paystack_reference: reference }).lean()) {
    return { ok: true, duplicate: true, message: 'Deposit already recorded.' };
  }

  const plan = await InstallmentPlan.findById(planId);
  if (!plan) return { ok: false, message: 'Sale not found.' };

  const amountGHS = (paystackData.amount || 0) / 100;
  const enough = amountGHS + 0.009 >= (plan.down_payment || 0);
  const currencyOk = !paystackData.currency || paystackData.currency === 'GHS';

  // Claim the plan atomically so a webhook + verify race activates it once.
  const claimed = enough && currencyOk
    ? await InstallmentPlan.findOneAndUpdate(
        { _id: plan._id, status: 'approved', down_payment_paid: { $ne: true } },
        { $set: { down_payment_paid: true, down_payment_reference: reference } },
        { new: true }
      )
    : null;

  // The other path (webhook vs. DSR verify) claimed this same payment: done.
  if (!claimed) {
    const fresh = await InstallmentPlan.findById(plan._id).select('down_payment_reference').lean();
    if (fresh?.down_payment_reference === reference) {
      return { ok: true, duplicate: true, message: 'Deposit already recorded.' };
    }
  }

  // Always keep a record of money received, even if it can't activate the sale.
  const notes = claimed ? 'Deposit (down payment) via Paystack' : 'Deposit via Paystack — NOT applied, needs admin review';
  try {
    await Payment.create({
      installment_plan_id: plan._id,
      customer_id: plan.customer_id,
      amount: amountGHS,
      payment_date: new Date(paystackData.paid_at || Date.now()),
      payment_method: 'paystack',
      paystack_reference: reference,
      paystack_status: paystackData.status,
      recorded_by: recordedBy,
      notes,
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
    if (!claimed) return { ok: true, duplicate: true, message: 'Deposit already recorded.' };
    // We claimed the plan but the other path wrote the record first — keep
    // going so the plan still activates, and fix the record's note.
    await Payment.updateOne({ paystack_reference: reference }, { $set: { notes } });
  }

  if (!claimed) {
    const why = !enough
      ? `Paid GH₵${amountGHS} but the deposit is GH₵${plan.down_payment}.`
      : !currencyOk ? `Unexpected currency ${paystackData.currency}.`
      : plan.status !== 'approved' ? `The sale is "${plan.status}", not approved.` : 'The deposit was already paid.';
    logger.warn('[deposit] Not applied for plan %s (ref %s): %s', plan._id, reference, why);
    return { ok: false, message: `Payment received but the sale was not activated: ${why} Contact the admin.` };
  }

  // DSR commission paid automatically by a Paystack split on this deposit?
  // Paystack reports the split on the transaction; metadata says which one we sent.
  const splitInfo = paystackData.split || {};
  const splitUsed = metadata.dsr_split_code &&
    (splitInfo.split_code === metadata.dsr_split_code || Object.keys(splitInfo).length > 0);
  if (splitUsed) {
    claimed.commission_split_paid = true;
    claimed.commission_split_amount = Number(metadata.dsr_commission) || 0;
  }

  await activatePlanNow(claimed, { userId: recordedBy, ip });
  logger.info('[deposit] Plan %s activated by deposit %s (GH₵%s)', plan._id, reference, amountGHS);

  const commissionNote = commissionMessage(claimed);
  notifyDsrOfDeposit(claimed, amountGHS, commissionNote);
  return {
    ok: true,
    activated: true,
    message: `Deposit received — the sale is active and the phone is unlocking. ${commissionNote}`,
  };
}

/** What the DSR is told about their commission for this sale. */
function commissionMessage(plan) {
  if (plan.commission_split_paid) {
    return `Your GHS ${Number(plan.commission_split_amount).toLocaleString()} commission will be paid to your account within 24 hours.`;
  }
  return 'Your commission for this sale is recorded and will be paid by the admin.';
}

/** SMS the DSR who made the sale that the deposit came in (fire-and-forget). */
function notifyDsrOfDeposit(plan, amountGHS, commissionNote) {
  ;(async () => {
    try {
      const [dsr, customer] = await Promise.all([
        User.findById(plan.created_by).select('phone role'),
        Customer.findById(plan.customer_id).select('full_name'),
      ]);
      if (!dsr?.phone || dsr.role !== 'staff') return;
      await sendSMS(dsr.phone,
        `Deposit of GHS ${Number(amountGHS).toLocaleString()} received for ${customer?.full_name || 'your customer'}. ` +
        `The phone is now active. ${commissionNote} -Dan & Dor Solar`
      );
    } catch (err) {
      logger.warn('[deposit] DSR SMS failed for plan %s: %s', plan._id, err.message);
    }
  })();
}

module.exports = { activatePlanNow, recordDeposit };
