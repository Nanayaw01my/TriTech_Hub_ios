/**
 * Public "Pay now" link (dandorsolar.site/p/<token>) — no login. Shows what the
 * customer owes and starts a Paystack checkout (Mobile Money or card). Payments
 * are recorded exactly like portal payments (verify here + Paystack webhook),
 * which moves the due date and unlocks the phone once they're caught up.
 */
const { v4: uuidv4 } = require('uuid');
const InstallmentPlan = require('../models/InstallmentPlan');
const Customer = require('../models/Customer');
const Device = require('../models/Device');
const User = require('../models/User');
const { initializePayment, verifyPayment } = require('../utils/paystack');
const { amountDue } = require('../utils/payLink');
const { processSuccessfulPayment } = require('./paymentController');
const { placeholderEmail } = require('../utils/customerEmail');
const logger = require('../utils/logger');

const PAYABLE = ['active', 'defaulted'];

async function loadByToken(token) {
  if (!/^[A-Za-z0-9]{6,32}$/.test(String(token || ''))) return null;
  const plan = await InstallmentPlan.findOne({ pay_token: token });
  if (!plan) return null;
  const customer = await Customer.findById(plan.customer_id).lean();
  if (!customer || customer.deleted_at) return null;
  const device = await Device.findById(plan.device_id).select('model lock_status agent.enrolled').lean();
  return { plan, customer, device };
}

/** GET /api/pay/:token — what's owed (first name only; nothing sensitive). */
const getPayInfo = async (req, res) => {
  try {
    const ctx = await loadByToken(req.params.token);
    if (!ctx) return res.status(404).json({ success: false, message: 'This payment link is not valid.' });
    const { plan, customer, device } = ctx;
    const payable = PAYABLE.includes(plan.status) && plan.remaining_balance > 0;
    return res.status(200).json({
      success: true,
      data: {
        first_name: String(customer.full_name || '').split(' ')[0],
        device_model: device?.model || 'Phone',
        status: plan.status,
        payable,
        locked: device?.lock_status === 'locked',
        overdue: payable && plan.next_due_date && new Date(plan.next_due_date) < new Date(),
        amount_due: payable ? amountDue(plan) : 0,
        installment_amount: plan.installment_amount,
        late_fees: Math.max(0, plan.penalty_balance || 0),
        frequency: plan.frequency,
        remaining_balance: plan.remaining_balance,
        next_due_date: plan.next_due_date,
      },
    });
  } catch (error) {
    logger.error('getPayInfo error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/** POST /api/pay/:token/initialize { amount? } — start a Paystack checkout. */
const initPayLink = async (req, res) => {
  try {
    const ctx = await loadByToken(req.params.token);
    if (!ctx) return res.status(404).json({ success: false, message: 'This payment link is not valid.' });
    const { plan, customer, device } = ctx;
    if (!PAYABLE.includes(plan.status) || !(plan.remaining_balance > 0)) {
      return res.status(400).json({ success: false, message: 'There is nothing to pay on this plan.' });
    }
    const requested = Number(req.body?.amount);
    const amount = Number.isFinite(requested) && requested > 0 ? Math.round(requested * 100) / 100 : amountDue(plan);
    if (amount < 1) return res.status(400).json({ success: false, message: 'The minimum payment is GHS 1.' });
    const maxPay = (plan.remaining_balance || 0) + (plan.penalty_balance || 0);
    if (amount > maxPay + 0.009) {
      return res.status(400).json({ success: false, message: `The most you can pay is GHS ${maxPay.toLocaleString()} (the full balance).` });
    }

    const user = await User.findById(customer.user_id).select('email account_number').lean();
    const reference = `DDP-${uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase()}`;
    const base = (process.env.FRONTEND_URL || process.env.PUBLIC_BACKEND_URL || 'https://dandorsolar.site').replace(/\/+$/, '');
    const paystackResponse = await initializePayment({
      email: user?.email || placeholderEmail(user?.account_number || customer._id),
      amount,
      reference,
      callback_url: `${base}/p/${plan.pay_token}?reference=${reference}`,
      metadata: {
        customer_id: customer._id.toString(),
        customer_name: customer.full_name,
        account_number: user?.account_number,
        plan_id: plan._id.toString(),
        device_model: device?.model,
        initiated_by_role: 'customer',
        via: 'pay_link',
      },
    });
    if (!paystackResponse.status) {
      return res.status(502).json({ success: false, message: 'Could not start the payment. Please try again.' });
    }
    return res.status(200).json({
      success: true,
      data: { authorization_url: paystackResponse.data.authorization_url, reference, amount },
    });
  } catch (error) {
    logger.error('initPayLink error: %s', error.response?.data ? JSON.stringify(error.response.data) : error.message);
    return res.status(500).json({ success: false, message: 'Could not start the payment. Please try again.' });
  }
};

/** GET /api/pay/:token/verify/:reference — confirm and record the payment. */
const verifyPayLink = async (req, res) => {
  try {
    const ctx = await loadByToken(req.params.token);
    if (!ctx) return res.status(404).json({ success: false, message: 'This payment link is not valid.' });
    let ps;
    try {
      ps = await verifyPayment(req.params.reference);
    } catch (e) {
      return res.status(200).json({ success: true, payment_pending: true, message: 'We are confirming your payment. It will show within a few minutes.' });
    }
    const data = ps.data || {};
    if (data.status === 'pending' || data.status === 'ongoing') {
      return res.status(200).json({ success: true, payment_pending: true, message: 'Approve the Mobile Money prompt on your phone. Your payment will be recorded automatically.' });
    }
    if (!ps.status || data.status !== 'success') {
      return res.status(400).json({ success: false, message: `Payment not completed (${data.status || 'unknown'}).` });
    }
    // The payment must belong to this link's plan.
    if (String(data.metadata?.plan_id) !== String(ctx.plan._id)) {
      return res.status(400).json({ success: false, message: 'This payment does not belong to this link.' });
    }
    const device = await Device.findById(ctx.plan.device_id).lean();
    const result = await processSuccessfulPayment({
      paystackData: data,
      customer: ctx.customer,
      plan: ctx.plan.toObject(),
      device,
      paidBy: { user_id: null, user_role: 'customer', name: ctx.customer.full_name },
      recordedBy: null,
      notes: 'Paid via Pay-now link',
    });
    const fresh = await InstallmentPlan.findById(ctx.plan._id).select('remaining_balance next_due_date status').lean();
    return res.status(200).json({
      success: true,
      data: {
        amount: data.amount / 100,
        duplicate: !!result.duplicate,
        completed: fresh?.status === 'completed',
        remaining_balance: fresh?.remaining_balance,
        next_due_date: fresh?.status === 'completed' ? null : fresh?.next_due_date,
        unlocked: !!result.deviceUnlocked,
        caught_up: result.duplicate ? undefined : result.caughtUp,
      },
    });
  } catch (error) {
    logger.error('verifyPayLink error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getPayInfo, initPayLink, verifyPayLink };
