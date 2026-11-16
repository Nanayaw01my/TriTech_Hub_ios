/**
 * Business report: sales, profit (where the phone's cost is known) and
 * collections, overall and per branch (the DSR's branch).
 */
const InstallmentPlan = require('../models/InstallmentPlan');
const Payment = require('../models/Payment');
const { amountDue } = require('./payLink');

const SOLD = ['active', 'defaulted', 'completed', 'closed', 'repossessed'];
const r2 = (n) => Math.round((n || 0) * 100) / 100;

function range(period) {
  const now = new Date();
  if (period === 'all') return { from: null, to: null };
  if (period === 'last_month') {
    return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)), to: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) };
  }
  if (period === 'year') return { from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), to: null };
  return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to: null }; // this month
}
const inRange = (d, { from, to }) => d && (!from || d >= from) && (!to || d < to);

async function businessReport(period = 'month') {
  const rg = range(period);
  const plans = await InstallmentPlan.find({ status: { $in: SOLD } })
    .select('status total_price down_payment remaining_balance penalty_balance installment_amount payments_made schedule next_due_date activated_at createdAt device_id created_by')
    .populate({ path: 'device_id', select: 'cost_price model' })
    .populate({ path: 'created_by', select: 'name branch role' })
    .lean();

  const branches = new Map();
  const row = (name) => {
    if (!branches.has(name)) branches.set(name, { branch: name, sales: 0, revenue: 0, profit: 0, cost_known: 0, collected: 0, outstanding: 0, overdue: 0, overdue_amount: 0 });
    return branches.get(name);
  };
  const total = { sales: 0, revenue: 0, deposits: 0, cost: 0, profit: 0, cost_known: 0, missing_cost: 0, collected: 0, outstanding: 0, overdue: 0, overdue_amount: 0 };
  const planBranch = new Map();
  const now = new Date();

  for (const p of plans) {
    const br = p.created_by?.role === 'staff' ? (p.created_by.branch || 'No branch') : 'Office (admin sales)';
    planBranch.set(String(p._id), br);
    const b = row(br);
    // Current position (not limited to the period).
    if (['active', 'defaulted'].includes(p.status)) {
      b.outstanding += p.remaining_balance || 0;
      total.outstanding += p.remaining_balance || 0;
      if (p.next_due_date && new Date(p.next_due_date) < now) {
        const due = amountDue(p);
        b.overdue += 1; b.overdue_amount += due;
        total.overdue += 1; total.overdue_amount += due;
      }
    }
    // Sales in the period (counted when the plan started).
    const soldAt = p.activated_at ? new Date(p.activated_at) : new Date(p.createdAt);
    if (rg.from || rg.to ? inRange(soldAt, rg) : true) {
      b.sales += 1; total.sales += 1;
      b.revenue += p.total_price || 0; total.revenue += p.total_price || 0;
      total.deposits += p.down_payment || 0;
      const cost = p.device_id?.cost_price;
      if (cost !== null && cost !== undefined) {
        const profit = (p.total_price || 0) - cost;
        b.profit += profit; b.cost_known += 1;
        total.cost += cost; total.profit += profit; total.cost_known += 1;
      } else {
        total.missing_cost += 1;
      }
    }
  }

  // Money collected in the period (deposits + installments), by branch.
  const payQ = {};
  if (rg.from || rg.to) {
    payQ.payment_date = {};
    if (rg.from) payQ.payment_date.$gte = rg.from;
    if (rg.to) payQ.payment_date.$lt = rg.to;
  }
  const pays = await Payment.find(payQ).select('amount installment_plan_id').lean();
  for (const pay of pays) {
    const br = planBranch.get(String(pay.installment_plan_id));
    total.collected += pay.amount || 0;
    if (br) row(br).collected += pay.amount || 0;
  }

  const out = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? r2(v) : v]));
  return {
    period, from: rg.from, to: rg.to,
    total: out(total),
    branches: [...branches.values()].map(out).sort((a, b) => b.revenue - a.revenue),
  };
}

module.exports = { businessReport };
