/**
 * Hire-purchase plan terms. Every phone is paid off over a fixed 4 months; the
 * customer only chooses how often they pay:
 *   daily  — the deposit counts as day 1, then 119 daily payments (120 days ≈ 4 months)
 *   weekly — the deposit counts as week 1, then 15 weekly payments (16 weeks ≈ 4 months)
 * The balance after the deposit is split evenly across those payments.
 */
const PLAN_MONTHS = 4;
const PLAN_PAYMENTS = { daily: 119, weekly: 15 };

/** { frequency, totalPayments } for an allowed frequency, else null. */
function planTerms(frequency) {
  const f = String(frequency || '').toLowerCase();
  return PLAN_PAYMENTS[f] ? { frequency: f, totalPayments: PLAN_PAYMENTS[f] } : null;
}

module.exports = { PLAN_MONTHS, PLAN_PAYMENTS, planTerms };
