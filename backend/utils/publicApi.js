/**
 * Public API (v1) for other systems, e.g. the shop management system.
 * Read sales (+ a summary for targets), payments and phones/stock, and record
 * payments taken at the shop. Every answer is JSON:
 *   { success: true, data: [...], page, limit, total, has_more }   (lists)
 *   { success: false, error: { code, message } }                    (errors)
 */
const InstallmentPlan = require('../models/InstallmentPlan');
const Payment = require('../models/Payment');
const Device = require('../models/Device');
const Customer = require('../models/Customer');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { apiError } = require('../middleware/apiKey');
const logger = require('./logger');

const SOLD = ['active', 'defaulted', 'completed', 'closed', 'repossessed'];
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const METHOD_OUT = { paystack: 'paystack', manual_cash: 'cash', manual_momo: 'momo', manual_bank: 'bank' };
const METHOD_IN = { cash: 'manual_cash', momo: 'manual_momo', bank: 'manual_bank' };

class BadRequest extends Error {}

/** from / to as YYYY-MM-DD (to is inclusive). Either can be left out. */
function dateRange(q) {
  const out = {};
  if (q.from) {
    const d = new Date(`${String(q.from).slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) throw new BadRequest('"from" must be a date like 2026-11-01.');
    out.$gte = d;
  }
  if (q.to) {
    const d = new Date(`${String(q.to).slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) throw new BadRequest('"to" must be a date like 2026-11-30.');
    out.$lt = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return Object.keys(out).length ? out : null;
}
function paging(q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(q.limit, 10) || 50));
  return { page, limit, skip: (page - 1) * limit };
}
const listOut = (res, rows, { page, limit }, total) =>
  res.status(200).json({ success: true, data: rows, page, limit, total, has_more: page * limit < total });

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (e) {
    if (e instanceof BadRequest) return apiError(res, 400, 'bad_request', e.message);
    logger.error('[api v1] %s %s: %s', req.method, req.path, e.message);
    return apiError(res, 500, 'server_error', 'Server error.');
  }
};

/** A DSR given as staff ID (e.g. DS-0003) or user id → user id. */
async function dsrId(value) {
  if (!value) return null;
  const v = String(value).trim();
  if (/^[0-9a-fA-F]{24}$/.test(v)) return v;
  const u = await User.findOne({ staff_id: v.toUpperCase() }).select('_id').lean();
  if (!u) throw new BadRequest(`No DSR with staff ID "${v}".`);
  return String(u._id);
}

const dsrOut = (u) => (u && u.role === 'staff'
  ? { id: u._id, name: u.name, staff_id: u.staff_id || null, branch: u.branch || null }
  : null);

function saleOut(p) {
  const c = p.customer_id || {};
  const d = p.device_id || {};
  const dsr = dsrOut(p.created_by);
  return {
    id: p._id,
    status: p.status,
    sold_at: p.activated_at || null,
    registered_at: p.createdAt,
    customer: { id: c._id || null, name: c.full_name || null, phone: c.phone || null, account_number: c.user_id?.account_number || null },
    phone: { model: d.model || null, imei: d.imei || null, serial_number: d.serial_number || null },
    price: r2(p.total_price),
    deposit: r2(p.down_payment),
    deposit_paid: !!p.down_payment_paid || SOLD.includes(p.status),
    frequency: p.frequency,
    installment_amount: r2(p.installment_amount),
    total_payments: p.total_payments,
    payments_made: p.payments_made || 0,
    balance: r2(p.remaining_balance),
    late_fees_owed: r2(p.penalty_balance),
    next_due_date: ['active', 'defaulted'].includes(p.status) ? p.next_due_date : null,
    dsr,
    branch: dsr ? dsr.branch : 'Office',
    sold_by: dsr ? 'dsr' : 'office',
  };
}

async function salesQuery(q) {
  const filter = {};
  const includePending = String(q.include_pending || '') === 'true';
  filter.status = includePending ? { $in: [...SOLD, 'pending', 'returned', 'approved'] } : { $in: SOLD };
  if (q.status) {
    const st = String(q.status).split(',').map((s) => s.trim()).filter(Boolean);
    filter.status = { $in: st };
  }
  const range = dateRange(q);
  if (range) filter[includePending ? 'createdAt' : 'activated_at'] = range;
  const dsr = await dsrId(q.dsr);
  if (dsr) filter.created_by = dsr;
  if (q.branch) {
    const ids = await User.find({ role: 'staff', branch: String(q.branch) }).distinct('_id');
    filter.created_by = { $in: ids };
  }
  return filter;
}

/** GET /api/v1/sales */
const listSales = wrap(async (req, res) => {
  const pg = paging(req.query);
  const filter = await salesQuery(req.query);
  const [rows, total] = await Promise.all([
    InstallmentPlan.find(filter).sort({ activated_at: -1, createdAt: -1 }).skip(pg.skip).limit(pg.limit)
      .populate({ path: 'customer_id', select: 'full_name phone user_id', populate: { path: 'user_id', select: 'account_number' } })
      .populate({ path: 'device_id', select: 'model imei serial_number' })
      .populate({ path: 'created_by', select: 'name staff_id branch role' })
      .lean(),
    InstallmentPlan.countDocuments(filter),
  ]);
  return listOut(res, rows.map(saleOut), pg, total);
});

/**
 * GET /api/v1/sales/summary — for targets: number of sales and sales value
 * per DSR, per branch and per month (by the day the deposit was paid), plus
 * money collected from each DSR's customers in the same dates.
 */
const salesSummary = wrap(async (req, res) => {
  const filter = await salesQuery({ ...req.query, include_pending: 'false', status: undefined });
  const plans = await InstallmentPlan.find(filter)
    .select('total_price down_payment activated_at createdAt created_by status')
    .populate({ path: 'created_by', select: 'name staff_id branch role' }).lean();

  const byDsr = new Map(); const byBranch = new Map(); const byMonth = new Map();
  const totals = { sales_count: 0, sales_value: 0, deposits: 0, collected: 0 };
  const add = (map, key, base) => {
    if (!map.has(key)) map.set(key, { ...base, sales_count: 0, sales_value: 0, deposits: 0, collected: 0 });
    return map.get(key);
  };
  const planInfo = new Map();
  for (const p of plans) {
    const dsr = dsrOut(p.created_by);
    const month = (p.activated_at || p.createdAt).toISOString().slice(0, 7);
    const dKey = dsr ? String(dsr.id) : 'office';
    const bKey = dsr?.branch || (dsr ? 'No branch' : 'Office');
    planInfo.set(String(p._id), { dKey, bKey });
    for (const row of [
      add(byDsr, dKey, { dsr_id: dsr?.id || null, dsr_name: dsr?.name || 'Office (admin sales)', staff_id: dsr?.staff_id || null, branch: bKey }),
      add(byBranch, bKey, { branch: bKey }),
      add(byMonth, `${month}|${dKey}`, { month, dsr_id: dsr?.id || null, dsr_name: dsr?.name || 'Office (admin sales)', staff_id: dsr?.staff_id || null, branch: bKey }),
      totals,
    ]) {
      row.sales_count += 1;
      row.sales_value += p.total_price || 0;
      row.deposits += p.down_payment || 0;
    }
  }
  // Money collected in the same dates from these DSRs' customers (all their plans).
  const range = dateRange(req.query);
  const payQ = range ? { payment_date: range } : {};
  const pays = await Payment.find(payQ).select('amount installment_plan_id').lean();
  const missing = [...new Set(pays.map((p) => String(p.installment_plan_id)).filter((id) => !planInfo.has(id)))];
  if (missing.length) {
    const more = await InstallmentPlan.find({ _id: { $in: missing } }).select('created_by')
      .populate({ path: 'created_by', select: 'name staff_id branch role' }).lean();
    for (const p of more) {
      const dsr = dsrOut(p.created_by);
      planInfo.set(String(p._id), { dKey: dsr ? String(dsr.id) : 'office', bKey: dsr?.branch || (dsr ? 'No branch' : 'Office'), dsr });
    }
  }
  for (const pay of pays) {
    const info = planInfo.get(String(pay.installment_plan_id));
    if (!info) continue;
    totals.collected += pay.amount || 0;
    if (byDsr.has(info.dKey)) byDsr.get(info.dKey).collected += pay.amount || 0;
    else if (info.dsr || info.dKey === 'office') {
      add(byDsr, info.dKey, { dsr_id: info.dsr?.id || null, dsr_name: info.dsr?.name || 'Office (admin sales)', staff_id: info.dsr?.staff_id || null, branch: info.bKey }).collected += pay.amount || 0;
    }
    if (byBranch.has(info.bKey)) byBranch.get(info.bKey).collected += pay.amount || 0;
    else add(byBranch, info.bKey, { branch: info.bKey }).collected += pay.amount || 0;
  }
  const out = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? r2(v) : v]));
  return res.status(200).json({
    success: true,
    data: {
      from: req.query.from || null,
      to: req.query.to || null,
      totals: out(totals),
      by_dsr: [...byDsr.values()].map(out).sort((a, b) => b.sales_count - a.sales_count),
      by_branch: [...byBranch.values()].map(out).sort((a, b) => b.sales_count - a.sales_count),
      by_month_and_dsr: [...byMonth.values()].map(out).sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : b.sales_count - a.sales_count)),
    },
  });
});

/** GET /api/v1/payments */
const listPayments = wrap(async (req, res) => {
  const pg = paging(req.query);
  const filter = {};
  const range = dateRange(req.query);
  if (range) filter.payment_date = range;
  if (req.query.method) {
    const m = METHOD_IN[req.query.method] || (req.query.method === 'paystack' ? 'paystack' : null);
    if (!m) throw new BadRequest('"method" must be paystack, cash, momo or bank.');
    filter.payment_method = m;
  }
  const includeCancelled = String(req.query.include_cancelled || '') === 'true';
  const q = () => Payment.find(filter).setOptions({ includeVoided: includeCancelled });
  const [rows, total] = await Promise.all([
    q().sort({ payment_date: -1 }).skip(pg.skip).limit(pg.limit)
      .populate({ path: 'customer_id', select: 'full_name phone user_id', populate: { path: 'user_id', select: 'account_number' } })
      .populate({ path: 'installment_plan_id', select: 'created_by', populate: { path: 'created_by', select: 'name staff_id branch role' } })
      .lean(),
    Payment.countDocuments(filter).setOptions({ includeVoided: includeCancelled }),
  ]);
  const data = rows.map((p) => {
    const dsr = dsrOut(p.installment_plan_id?.created_by);
    return {
      id: p._id,
      date: p.payment_date,
      amount: r2(p.amount),
      method: METHOD_OUT[p.payment_method] || p.payment_method,
      kind: Payment.isDeposit(p) ? 'deposit' : 'installment',
      late_fees_part: r2(p.applied_penalty || 0),
      reference: p.paystack_reference || p.external_ref || null,
      customer: { id: p.customer_id?._id || null, name: p.customer_id?.full_name || null, phone: p.customer_id?.phone || null, account_number: p.customer_id?.user_id?.account_number || null },
      sale_id: p.installment_plan_id?._id || null,
      dsr,
      recorded_by: p.paid_by?.name || null,
      source: p.source || (p.payment_method === 'paystack' ? 'paystack' : 'dan_dor_app'),
      cancelled: !!p.voided,
      cancel_reason: p.voided ? p.void_reason || null : undefined,
      note: p.notes || null,
    };
  });
  return listOut(res, data, pg, total);
});

/** GET /api/v1/stock?status=in_stock|sold|all */
const listStock = wrap(async (req, res) => {
  const pg = paging(req.query);
  const status = String(req.query.status || 'all');
  const filter = {};
  if (status === 'in_stock') { filter['agent.enrolled'] = true; filter.assigned_to = null; }
  else if (status === 'sold') filter.assigned_to = { $ne: null };
  else if (status !== 'all') throw new BadRequest('"status" must be in_stock, sold or all.');
  const [rows, total] = await Promise.all([
    Device.find(filter).sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit)
      .select('model imei serial_number price price_set_by_admin cost_price assigned_to held_by lock_status agent.enrolled agent.enrollment_status agent.last_heartbeat agent.app_version createdAt')
      .populate({ path: 'assigned_to', select: 'full_name' })
      .populate({ path: 'held_by', select: 'name staff_id' })
      .lean(),
    Device.countDocuments(filter),
  ]);
  const data = rows.map((d) => ({
    id: d._id,
    model: d.model,
    imei: d.imei || null,
    serial_number: d.serial_number || null,
    price: d.price_set_by_admin ? r2(d.price) : null,
    cost: d.cost_price ?? null,
    status: d.assigned_to ? 'sold' : d.agent?.enrollment_status === 'released' ? 'released' : d.agent?.enrolled ? 'in_stock' : 'not_set_up',
    customer_name: d.assigned_to?.full_name || null,
    held_by: d.held_by ? { name: d.held_by.name, staff_id: d.held_by.staff_id || null } : null,
    locked: d.lock_status === 'locked',
    last_check_in: d.agent?.last_heartbeat || null,
    app_version: d.agent?.app_version || null,
    added_at: d.createdAt,
  }));
  return listOut(res, data, pg, total);
});

// One request at a time per shop reference, so a payment sent twice is recorded once.
const refQueue = new Map();
function onePerRef(key, fn) {
  const prev = refQueue.get(key) || Promise.resolve();
  const run = prev.catch(() => {}).then(fn);
  refQueue.set(key, run);
  run.finally(() => { if (refQueue.get(key) === run) refQueue.delete(key); }).catch(() => {});
  return run;
}

/**
 * POST /api/v1/payments — record a payment taken at the shop.
 * Body: { account_number (or customer_id), amount, method: cash|momo|bank,
 *         reference (your own unique id for this payment), note? }
 */
const recordPayment = wrap(async (req, res) => {
  const b = req.body || {};
  const ref = String(b.reference || '').trim().slice(0, 80);
  if (!ref) throw new BadRequest('"reference" is required: your own unique id for this payment (it stops it being recorded twice).');
  const amt = r2(b.amount);
  if (!(amt > 0)) throw new BadRequest('"amount" must be more than 0.');
  const method = METHOD_IN[String(b.method || 'cash')];
  if (!method) throw new BadRequest('"method" must be cash, momo or bank (Paystack payments are recorded automatically).');
  const key = req.apiKey;
  const extRef = `${key._id}:${ref}`;

  return onePerRef(extRef, async () => {
    const existing = await Payment.findOne({ external_ref: extRef }).setOptions({ includeVoided: true }).lean();
    if (existing) {
      return res.status(200).json({ success: true, duplicate: true, data: { payment_id: existing._id, amount: r2(existing.amount), cancelled: !!existing.voided, message: 'This reference was already recorded — nothing was added.' } });
    }
    let customer = null;
    if (b.account_number) {
      const u = await User.findOne({ account_number: String(b.account_number).trim().toUpperCase() }).select('_id').lean();
      if (u) customer = await Customer.findOne({ user_id: u._id, deleted_at: null }).lean();
    } else if (b.customer_id && /^[0-9a-fA-F]{24}$/.test(String(b.customer_id))) {
      customer = await Customer.findOne({ _id: b.customer_id, deleted_at: null }).lean();
    } else {
      throw new BadRequest('Send "account_number" (e.g. DBS202600234) or "customer_id".');
    }
    if (!customer) return apiError(res, 404, 'customer_not_found', 'No customer with that account number.');
    const plan = await InstallmentPlan.findOne({ customer_id: customer._id }).sort({ createdAt: -1 }).lean();
    if (!plan) return apiError(res, 404, 'no_plan', 'This customer has no plan.');
    if (!['active', 'defaulted'].includes(plan.status)) {
      return apiError(res, 409, 'plan_not_payable', plan.status === 'approved' || plan.status === 'pending' || plan.status === 'returned'
        ? 'The deposit must be paid through Paystack first; installments can be recorded after that.'
        : `This plan is ${plan.status} — nothing to pay.`);
    }
    const maxPay = r2((plan.remaining_balance || 0) + (plan.penalty_balance || 0));
    if (amt > maxPay + 0.009) return apiError(res, 400, 'too_much', `That's more than the customer owes (GHS ${maxPay} including late fees).`);

    const device = plan.device_id ? await Device.findById(plan.device_id).lean() : null;
    const { processSuccessfulPayment } = require('../controllers/paymentController');
    const note = String(b.note || '').trim().slice(0, 200);
    const label = { manual_cash: 'Cash', manual_momo: 'Mobile Money', manual_bank: 'Bank transfer' }[method];
    const result = await processSuccessfulPayment({
      paystackData: { amount: Math.round(amt * 100), paid_at: Date.now(), reference: null, status: method },
      customer, plan, device,
      paidBy: { user_id: null, user_role: 'api', name: `Shop system (${key.name})` },
      recordedBy: null,
      notes: `${label} recorded by ${key.name} (ref ${ref})${note ? ` — ${note}` : ''}`,
      method,
    });
    await Payment.updateOne({ _id: result.payment._id }, { $set: { external_ref: extRef, source: key.name } });
    await AuditLog.create({
      action: 'api_payment', target_user_id: customer.user_id, ip_address: req.ip,
      details: { api_key: key.name, customer_id: customer._id, plan_id: plan._id, amount: amt, method, reference: ref },
    }).catch(() => {});
    const fresh = await InstallmentPlan.findById(plan._id).select('remaining_balance penalty_balance payments_made next_due_date status').lean();
    return res.status(201).json({
      success: true,
      data: {
        payment_id: result.payment._id,
        amount: amt,
        customer: { name: customer.full_name, account_number: String(b.account_number || '') || null },
        balance: r2(fresh?.remaining_balance),
        late_fees_owed: r2(fresh?.penalty_balance),
        payments_made: fresh?.payments_made,
        next_due_date: fresh?.status === 'completed' ? null : fresh?.next_due_date || null,
        plan_completed: fresh?.status === 'completed',
        phone_unlocked: !!result.deviceUnlocked,
      },
    });
  });
});

/** GET /api/v1/me — check a key works and see what it may do. */
const whoAmI = (req, res) => res.status(200).json({ success: true, data: { name: req.apiKey.name, permissions: req.apiKey.scopes } });

module.exports = { listSales, salesSummary, listPayments, listStock, recordPayment, whoAmI };
