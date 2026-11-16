/**
 * Money checks:
 *  - Cash-up: cash / MoMo / bank payments recorded by staff, per person, and
 *    which have been handed in to the office.
 *  - Paystack check: every successful Paystack payment vs what the system
 *    recorded (catches a missed webhook), plus Paystack's payouts to the bank.
 */
const Payment = require('../models/Payment');
const paystack = require('./paystack');
const logger = require('./logger');

const r2 = (n) => Math.round((n || 0) * 100) / 100;
const DAY = 24 * 60 * 60 * 1000;

function dayRange(from, to) {
  const f = from ? new Date(from) : new Date();
  const t = to ? new Date(to) : new Date(f);
  const start = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()));
  const end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) + DAY);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error('Bad dates');
  if (end - start > 62 * DAY) throw new Error('Choose 2 months or less.');
  return { start, end };
}

async function cashUp({ from, to }) {
  const { start, end } = dayRange(from, to);
  const pays = await Payment.find({
    payment_method: { $in: ['manual_cash', 'manual_momo', 'manual_bank'] },
    payment_date: { $gte: start, $lt: end },
  }).sort({ payment_date: 1 })
    .populate({ path: 'customer_id', select: 'full_name' })
    .populate({ path: 'recorded_by', select: 'name role staff_id' })
    .populate({ path: 'cash_received_by', select: 'name' })
    .lean();
  const people = new Map();
  for (const p of pays) {
    const who = p.paid_by?.name || p.recorded_by?.name || 'Unknown';
    const key = String(p.paid_by?.user_id || p.recorded_by?._id || who);
    if (!people.has(key)) people.set(key, { key, name: who, role: p.recorded_by?.role || p.paid_by?.user_role || '', total: 0, handed_in: 0, pending: 0, payments: [] });
    const row = people.get(key);
    row.total += p.amount;
    if (p.cash_received_at) row.handed_in += p.amount; else row.pending += p.amount;
    row.payments.push({
      _id: p._id, amount: p.amount, method: p.payment_method, at: p.payment_date,
      customer: p.customer_id?.full_name || '', customer_id: p.customer_id?._id,
      received_at: p.cash_received_at, received_by: p.cash_received_by?.name || '',
    });
  }
  const list = [...people.values()].map((r) => ({ ...r, total: r2(r.total), handed_in: r2(r.handed_in), pending: r2(r.pending) }))
    .sort((a, b) => b.pending - a.pending);
  return {
    from: start, to: new Date(end - 1),
    total: r2(list.reduce((s, r) => s + r.total, 0)),
    pending: r2(list.reduce((s, r) => s + r.pending, 0)),
    people: list,
  };
}

async function markHandedIn({ ids, user, undo = false }) {
  const r = await Payment.updateMany(
    { _id: { $in: ids }, payment_method: { $in: ['manual_cash', 'manual_momo', 'manual_bank'] } },
    undo ? { $set: { cash_received_at: null, cash_received_by: null } } : { $set: { cash_received_at: new Date(), cash_received_by: user?._id || null } },
  );
  return r.modifiedCount || 0;
}

async function paystackCheck({ from, to }) {
  const { start, end } = dayRange(from, to);
  // Everything Paystack says was paid in the period.
  const txs = [];
  let fetchError = null;
  try {
    for (let page = 1; page <= 10; page++) {
      const r = await paystack.listTransactions({ status: 'success', from: start.toISOString(), to: end.toISOString(), perPage: 100, page });
      const data = r?.data || [];
      txs.push(...data);
      const meta = r?.meta || {};
      if (!data.length || (meta.pageCount && page >= meta.pageCount)) break;
    }
  } catch (e) {
    fetchError = e.response?.data?.message || e.message;
    logger.error('[paystack-check] %s', fetchError);
  }
  // What the system recorded (cancelled ones too, to explain them).
  const ours = await Payment.find({ payment_method: 'paystack', paystack_reference: { $ne: null } })
    .setOptions({ includeVoided: true })
    .where('payment_date').gte(new Date(start - 2 * DAY)).lt(new Date(end.getTime() + 2 * DAY))
    .populate({ path: 'customer_id', select: 'full_name' })
    .lean();
  const ourByRef = new Map(ours.map((p) => [p.paystack_reference, p]));

  const missing = [];
  const cancelledInSystem = [];
  let paystackTotal = 0; let fees = 0; let matched = 0;
  const seen = new Set();
  for (const t of txs) {
    if (t.metadata?.type === 'demo_test') continue;
    paystackTotal += (t.amount || 0) / 100;
    fees += (t.fees || 0) / 100;
    seen.add(t.reference);
    const mine = ourByRef.get(t.reference);
    const row = {
      reference: t.reference, amount: (t.amount || 0) / 100, paid_at: t.paid_at || t.created_at,
      channel: t.channel, email: t.customer?.email || '', type: t.metadata?.type || 'installment',
      customer: t.metadata?.customer_name || '',
    };
    if (!mine) missing.push(row);
    else if (mine.voided) cancelledInSystem.push({ ...row, customer: mine.customer_id?.full_name || row.customer, reason: mine.void_reason });
    else matched += 1;
  }
  const notInPaystack = fetchError ? [] : ours
    .filter((p) => !p.voided && p.payment_date >= start && p.payment_date < end && !seen.has(p.paystack_reference))
    .map((p) => ({ reference: p.paystack_reference, amount: p.amount, paid_at: p.payment_date, customer: p.customer_id?.full_name || '' }));

  let settlements = [];
  try {
    const s = await paystack.listSettlements({ from: start.toISOString(), to: end.toISOString(), perPage: 50 });
    settlements = (s?.data || []).map((x) => ({
      id: x.id, amount: (x.total_amount ?? x.effective_amount ?? x.amount ?? 0) / 100,
      status: x.status, date: x.settlement_date || x.settled_at || x.createdAt || x.created_at,
    }));
  } catch (e) {
    logger.warn('[paystack-check] settlements: %s', e.response?.data?.message || e.message);
  }

  return {
    from: start, to: new Date(end - 1), error: fetchError,
    paystack_count: txs.filter((t) => t.metadata?.type !== 'demo_test').length, paystack_total: r2(paystackTotal), fees: r2(fees), net: r2(paystackTotal - fees),
    matched, missing, cancelled_in_system: cancelledInSystem, not_in_paystack: notInPaystack,
    settlements, settled_total: r2(settlements.reduce((s, x) => s + (x.amount || 0), 0)),
  };
}

/** Record a Paystack payment the system missed (checked with Paystack first). */
async function recordMissed(reference) {
  const v = await paystack.verifyPayment(reference);
  if (!v?.status || v.data?.status !== 'success') return { ok: false, message: `Paystack says this payment is "${v?.data?.status || 'unknown'}".` };
  const { applyPaystackCharge } = require('../controllers/paymentController');
  return applyPaystackCharge(v.data);
}

module.exports = { cashUp, markHandedIn, paystackCheck, recordMissed };
