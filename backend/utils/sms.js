const axios = require('axios');

const ARKESEL_API_KEY = process.env.ARKESEL_API_KEY;
const SENDER_ID       = process.env.ARKESEL_SENDER_ID || 'TritechHub';
const BASE_URL        = 'https://sms.arkesel.com/sms/api';

const formatPhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('233')) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '233' + digits.slice(1);
  if (digits.length === 9) return '233' + digits;
  return digits;
};

const sendSMS = async (to, message) => {
  if (!ARKESEL_API_KEY) {
    console.warn('[SMS] ARKESEL_API_KEY not set — skipping SMS');
    return;
  }
  const phone = formatPhone(to);
  if (!phone) {
    console.warn('[SMS] Invalid phone number:', to);
    return;
  }
  try {
    const res = await axios.get(BASE_URL, {
      params: {
        action: 'send-sms',
        api_key: ARKESEL_API_KEY,
        to: phone,
        from: SENDER_ID,
        sms: message,
      },
    });
    console.log(`[SMS] Sent to ${phone}:`, res.data);
    return res.data;
  } catch (err) {
    console.error('[SMS] Failed to send:', err.message);
  }
};

// ── Admin: new sale alert ──────────────────────────────────────────────────────
const sendAdminSaleSMS = async (adminPhone, sale) => {
  const msg =
    `New Sale Alert!\n` +
    `Staff: ${sale.staffName}${sale.branch ? ' @ ' + sale.branch : ''}\n` +
    `Customer: ${sale.customerName} (${sale.customerPhone || 'no phone'})\n` +
    `Device: ${sale.deviceModel}\n` +
    `Price: GHS ${Number(sale.totalPrice).toLocaleString()}\n` +
    `Down Payment: GHS ${Number(sale.downPayment).toLocaleString()}\n` +
    `Installment: GHS ${Number(sale.installmentAmount).toLocaleString()} x ${sale.totalPayments}`;
  await sendSMS(adminPhone, msg);
};

// ── Customer: welcome after registration ──────────────────────────────────────
const sendCustomerWelcomeSMS = async (phone, name, accountNumber, loginUrl) => {
  const msg =
    `Welcome to Tritech Hub iOS, ${name}!\n` +
    `Account No: ${accountNumber}\n` +
    `Login: ${loginUrl || 'tritechhub.online'}\n` +
    `Use your email & password set by staff to log in.`;
  await sendSMS(phone, msg);
};

// ── Customer: payment reminder ────────────────────────────────────────────────
const sendPaymentReminderSMS = async (phone, name, details) => {
  const { deviceModel, installmentAmount, nextDueDate, isOverdue } = details;
  const due = nextDueDate ? new Date(nextDueDate).toLocaleDateString('en-GH') : 'N/A';
  const msg = isOverdue
    ? `Hi ${name}, your ${deviceModel} installment of GHS ${Number(installmentAmount).toLocaleString()} is OVERDUE (due ${due}). Pay now to avoid device lock. Log in at tritechhub.online`
    : `Hi ${name}, reminder: your ${deviceModel} installment of GHS ${Number(installmentAmount).toLocaleString()} is due on ${due}. Log in at tritechhub.online to pay.`;
  await sendSMS(phone, msg);
};

// ── Customer: device locked ───────────────────────────────────────────────────
const sendDeviceLockedSMS = async (phone, name, deviceModel) => {
  const msg =
    `Hi ${name}, your ${deviceModel} has been locked due to a missed payment. ` +
    `Make your installment payment at tritechhub.online to restore access. ` +
    `Call us if you need help.`;
  await sendSMS(phone, msg);
};

// ── Customer: device unlocked ─────────────────────────────────────────────────
const sendDeviceUnlockedSMS = async (phone, name, deviceModel) => {
  const msg =
    `Hi ${name}, your ${deviceModel} has been unlocked. ` +
    `Thank you for your payment! Log in at tritechhub.online to view your plan.`;
  await sendSMS(phone, msg);
};

// ── Customer: payment confirmed ───────────────────────────────────────────────
const sendPaymentConfirmedSMS = async (phone, name, amount, details) => {
  const { deviceModel, remainingBalance, reference } = details;
  const msg =
    `Hi ${name}, payment of GHS ${Number(amount).toLocaleString()} for your ${deviceModel} confirmed.` +
    (reference ? ` Ref: ${reference}.` : '') +
    ` Remaining balance: GHS ${Number(remainingBalance).toLocaleString()}. -Tritech Hub iOS`;
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
