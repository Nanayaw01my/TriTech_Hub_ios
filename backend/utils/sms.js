const axios = require('axios');

const ARKESEL_API_KEY = process.env.ARKESEL_API_KEY;
const SENDER_ID       = process.env.ARKESEL_SENDER_ID || 'Tritech';

const formatPhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '233' + digits.slice(1);
  if (digits.length === 9) return '233' + digits;
  return digits;
};

const sendSMS = async (to, message) => {
  if (!ARKESEL_API_KEY) {
    console.warn('[SMS] ARKESEL_API_KEY not set — skipping');
    return;
  }
  const phone = formatPhone(to);
  if (!phone) {
    console.warn('[SMS] Invalid phone:', to);
    return;
  }

  // Use Arkesel v2 API — better delivery rates
  try {
    const res = await axios.post(
      'https://sms.arkesel.com/api/v2/sms/send',
      { sender: SENDER_ID, message, recipients: [phone] },
      { headers: { 'api-key': ARKESEL_API_KEY } }
    );
    console.log(`[SMS] v2 sent to ${phone}:`, JSON.stringify(res.data));
    return res.data;
  } catch (v2Err) {
    console.warn(`[SMS] v2 failed (${v2Err.response?.status}), trying v1...`);
  }

  // Fallback to v1 API
  try {
    const res = await axios.get('https://sms.arkesel.com/sms/api', {
      params: { action: 'send-sms', api_key: ARKESEL_API_KEY, to: phone, from: SENDER_ID, sms: message },
    });
    console.log(`[SMS] v1 sent to ${phone}:`, JSON.stringify(res.data));
    return res.data;
  } catch (v1Err) {
    const detail = v1Err.response?.data ? JSON.stringify(v1Err.response.data) : v1Err.message;
    console.error(`[SMS] Both v1+v2 failed for ${phone}:`, detail);
  }
};

// keep messages under 160 chars
const sendAdminSaleSMS = async (adminPhone, sale) => {
  const branch = sale.branch ? `, ${sale.branch} Branch` : '';
  const freq   = sale.frequency === 'monthly' ? 'month' : sale.frequency === 'weekly' ? 'week' : 'day';
  const price  = Number(sale.totalPrice).toLocaleString();
  const down   = Number(sale.downPayment).toLocaleString();
  const inst   = Number(sale.installmentAmount).toLocaleString();
  const n      = sale.totalPayments;

  const msg = `Tritech Hub Sale Alert\n${sale.deviceModel} sold by ${sale.staffName}${branch}.\nCustomer: ${sale.customerName} (${sale.customerPhone || 'N/A'})\nPrice: GHS ${price} | Down: GHS ${down}\nPlan: GHS ${inst} x ${n} payments/${freq}`;
  await sendSMS(adminPhone, msg);
};

const sendCustomerWelcomeSMS = async (phone, name, accountNumber) => {
  const msg = `Welcome ${name}! Acct: ${accountNumber}. Login at tritechhub.online with your email & password. -Tritech Hub`;
  await sendSMS(phone, msg);
};

const sendPaymentReminderSMS = async (phone, name, details) => {
  const { installmentAmount, nextDueDate, isOverdue } = details;
  const due = nextDueDate ? new Date(nextDueDate).toLocaleDateString('en-GH') : 'N/A';
  const msg = isOverdue
    ? `URGENT ${name}: GHS ${Number(installmentAmount).toLocaleString()} overdue (${due}). Pay now at tritechhub.online to avoid lock. -Tritech`
    : `Hi ${name}, GHS ${Number(installmentAmount).toLocaleString()} due ${due}. Pay at tritechhub.online -Tritech`;
  await sendSMS(phone, msg);
};

const sendDeviceLockedSMS = async (phone, name, deviceModel) => {
  const msg = `Hi ${name}, your ${deviceModel} has been locked. Pay at tritechhub.online to unlock. -Tritech Hub`;
  await sendSMS(phone, msg);
};

const sendDeviceUnlockedSMS = async (phone, name, deviceModel) => {
  const msg = `Hi ${name}, your ${deviceModel} has been unlocked. Thank you for your payment! -Tritech Hub`;
  await sendSMS(phone, msg);
};

const sendPaymentConfirmedSMS = async (phone, name, amount, details) => {
  const { deviceModel, remainingBalance } = details;
  const msg = `Hi ${name}, GHS ${Number(amount).toLocaleString()} received for your ${deviceModel}. Balance: GHS ${Number(remainingBalance).toLocaleString()}. -Tritech Hub`;
  await sendSMS(phone, msg);
};

module.exports = {
  sendSMS,
  sendAdminSaleSMS,
  sendCustomerWelcomeSMS,
  sendPaymentReminderSMS,
  sendDeviceLockedSMS,
  sendDeviceUnlockedSMS,
  sendPaymentConfirmedSMS,
};
