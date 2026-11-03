// Plain-English name for how a payment was made.
const LABELS = {
  paystack: 'Mobile Money / Card',
  manual_cash: 'Cash',
  manual_momo: 'MoMo (office)',
  manual_bank: 'Bank transfer',
}

export const paymentMethodLabel = (m) => LABELS[m] || (m ? String(m).replace(/_/g, ' ') : 'Mobile Money / Card')
