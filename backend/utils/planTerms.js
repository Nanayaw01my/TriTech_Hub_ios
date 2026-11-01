/**
 * Hire-purchase plan terms. Every phone is paid off over a fixed 4 months; the
 * customer only chooses how often they pay:
 *   daily  — 120 payments (4 months x ~30 days)
 *   weekly —  17 payments (17 weeks ≈ 4 months)
 * The balance after the deposit is split evenly across those payments.
 */
const PLAN_MONTHS = 4;
const PLAN_PAYMENTS = { daily: 120, weekly: 17 };

/** { frequency, totalPayments } for an allowed frequency, else null. */
function planTerms(frequency) {
  const f = String(frequency || '').toLowerCase();
  return PLAN_PAYMENTS[f] ? { frequency: f, totalPayments: PLAN_PAYMENTS[f] } : null;
}

module.exports = { PLAN_MONTHS, PLAN_PAYMENTS, planTerms };
