import api from '../api/axios'
import toast from 'react-hot-toast'

/**
 * Admin: open a customer's Pay-now page (Paystack — MoMo prompt to their
 * phone, or card). The page shows the amount due (late fees and part payments
 * included); a successful payment is recorded and unlocks the phone by itself.
 */
export async function openPayPage(navigate, customerId, back) {
  const t = toast.loading('Opening payment…')
  try {
    const res = await api.get(`/admin/customers/${customerId}/pay-link`)
    const token = res.data?.data?.token
    toast.dismiss(t)
    if (!token) { toast.error('Could not open the payment page.'); return }
    navigate(`/p/${token}`, { state: { back, backLabel: 'Back to customer' } })
  } catch (err) {
    toast.dismiss(t)
    toast.error(err?.response?.data?.message || 'Could not open the payment page.')
  }
}
