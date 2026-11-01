/**
 * "Pay now" links: dandorsolar.site/p/<token>. Each plan gets a random token
 * the first time a link is needed; the link opens a no-login page where the
 * customer pays by Mobile Money or card through Paystack.
 */
const crypto = require('crypto');
const InstallmentPlan = require('../models/InstallmentPlan');
const agent = require('./androidAgent');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // no look-alikes
const newToken = (len = 10) => Array.from(crypto.randomBytes(len), (b) => ALPHABET[b % ALPHABET.length]).join('');

/** Short host for texts, e.g. "dandorsolar.site" (no https:// to save characters). */
const shortHost = () => agent.config.BACKEND_URL.replace(/^https?:\/\//i, '').replace(/\/+$/, '');

/** Make sure the plan has a pay token; returns the short link for texts. */
async function ensurePayLink(plan) {
  if (!plan) return null;
  let token = plan.pay_token;
  if (!token) {
    for (let i = 0; i < 5 && !token; i++) {
      const t = newToken();
      const r = await InstallmentPlan.updateOne(
        { _id: plan._id, pay_token: { $in: [null, undefined] } },
        { $set: { pay_token: t } }
      ).catch(() => null);
      if (r?.modifiedCount) token = t;
      else {
        const fresh = await InstallmentPlan.findById(plan._id).select('pay_token').lean();
        token = fresh?.pay_token || null;
      }
    }
    if (token) plan.pay_token = token;
  }
  return token ? `${shortHost()}/p/${token}` : null;
}

/**
 * What the customer owes right now: every unpaid installment due by the end of
 * tomorrow (at least one installment), capped at the remaining balance.
 */
function amountDue(plan) {
  const remaining = Math.max(0, Number(plan.remaining_balance) || 0);
  const per = Number(plan.installment_amount) || 0;
  const horizon = Date.now() + 36 * 60 * 60 * 1000;
  const dueItems = (plan.schedule || []).filter((s) => !s.paid && new Date(s.due_date).getTime() <= horizon);
  // Money already paid toward the next unpaid installment (part-payments).
  const financed = Math.max(0, (plan.total_price || 0) - (plan.down_payment || 0));
  const credit = Math.max(0, financed - remaining - (plan.payments_made || 0) * per);
  // Nothing due yet (paid ahead): suggest one installment.
  let due = dueItems.length ? dueItems.length * per - credit : per;
  if (due <= 0) due = per;
  due = Math.min(remaining, due);
  // Plus any late fees (paid first).
  due += Math.max(0, Number(plan.penalty_balance) || 0);
  return Math.round(due * 100) / 100;
}

module.exports = { ensurePayLink, amountDue, newToken, shortHost };
