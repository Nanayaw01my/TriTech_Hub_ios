/**
 * Money figures for a plan, worked out from what the server stores:
 *  - deposit: the down payment (counted once it's paid),
 *  - onBalance: paid toward the balance after the deposit (installments,
 *    including part payments),
 *  - totalPaid: deposit + onBalance,
 *  - partPaid / partLeft: a part payment toward the next installment
 *    (e.g. GHS 100 of 182.36 paid, 82.36 still due by the next due date).
 * Late fees are not included (they're paid separately, first).
 */
export function planMoney(plan) {
  if (!plan) return { deposit: 0, onBalance: 0, totalPaid: 0, partPaid: 0, partLeft: 0 }
  const price = Number(plan.total_price || plan.device_price || 0)
  const down = Number(plan.down_payment || 0)
  const remaining = Math.max(0, Number(plan.remaining_balance || 0))
  const per = Number(plan.installment_amount || 0)
  const depositPaid = !!plan.down_payment_paid || ['active', 'defaulted', 'completed', 'closed'].includes(plan.status)
  const deposit = depositPaid ? down : 0
  const round = (n) => Math.round(n * 100) / 100
  const onBalance = round(Math.max(0, price - down - remaining))
  const partPaid = per > 0 && remaining > 0 ? round(Math.max(0, onBalance - (plan.payments_made || 0) * per)) : 0
  const partLeft = partPaid > 0 ? round(Math.max(0, Math.min(per, remaining) - partPaid)) : 0
  return { deposit, onBalance, totalPaid: round(deposit + onBalance), partPaid, partLeft }
}
