import api from '../api/axios'
import toast from 'react-hot-toast'

/**
 * Customer app: open my Pay-now page. It shows the amount due now (late fees
 * and part payments included) and lets me pay more to get ahead.
 */
export async function openMyPayPage(navigate) {
  const t = toast.loading('Opening payment…')
  try {
    const r = await api.get('/customer/pay-link')
    toast.dismiss(t)
    const token = r.data?.data?.token
    if (!token) { toast.error('No payment due right now.'); return }
    navigate(`/p/${token}`, { state: { back: '/customer/dashboard', backLabel: 'Back to my account' } })
  } catch (err) {
    toast.dismiss(t)
    toast.error(err?.response?.data?.message || 'Could not open the payment page.')
  }
}
