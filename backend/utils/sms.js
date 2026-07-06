const axios = require('axios');

const logger = require('./logger');

// ── Arkesel (used for WhatsApp; kept as an optional SMS fallback) ──────────────
const ARKESEL_API_KEY = process.env.ARKESEL_API_KEY;
const SENDER_ID       = process.env.ARKESEL_SENDER_ID || 'Tritech';

// ── NkomoSMS (primary SMS provider) ───────────────────────────────────────────
const NKOMO_API_TOKEN = process.env.NKOMOSMS_API_TOKEN;
const NKOMO_SENDER_ID = process.env.NKOMOSMS_SENDER_ID || 'TRITECHHUB';
const NKOMO_SEND_URL  = 'https://app.nkomosms.com/api/http/sms/send';

const formatPhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '233' + digits.slice(1);
  if (digits.length === 9) return '233' + digits;
  return digits;
};

// ── Arkesel SMS (fallback only) ───────────────────────────────────────────────
const sendSMSViaArkesel = async (phone, message) => {
  if (!ARKESEL_API_KEY) return null;
  try {
    const res = await axios.post(
      'https://sms.arkesel.com/api/v2/sms/send',
      { sender: SENDER_ID, message, recipients: [phone] },
      { headers: { 'api-key': ARKESEL_API_KEY }, timeout: 15000 }
    );
    logger.info(`[SMS] Arkesel fallback sent to ${phone}:`, JSON.stringify(res.data));
    return res.data;
  } catch (err) {
    logger.error(`[SMS] Arkesel fallback failed for ${phone}:`, err.response?.data ? JSON.stringify(err.response.data) : err.message);
    return null;
  }
};

// ── Primary SMS sender: NkomoSMS (v3 Bearer → HTTP API → Arkesel fallback) ─────
const sendSMS = async (to, message) => {
  const phone = formatPhone(to);
  if (!phone) {
    logger.warn('[SMS] Invalid phone:', to);
    return;
  }

  if (!NKOMO_API_TOKEN) {
    logger.warn('[SMS] NKOMOSMS_API_TOKEN not set — falling back to Arkesel');
    return sendSMSViaArkesel(phone, message);
  }

  // Primary: NkomoSMS — POST with api_token in the JSON body (per their docs)
  try {
    const res = await axios.post(
      NKOMO_SEND_URL,
      {
        api_token: NKOMO_API_TOKEN,
        recipient: phone,
        sender_id: NKOMO_SENDER_ID,
        type: 'plain',
        message,
      },
      {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 15000,
      }
    );
    // NkomoSMS returns { status: 'success' | 'error', ... }
    if (res.data && res.data.status === 'error') {
      logger.error(`[SMS] NkomoSMS rejected for ${phone}: ${res.data.message}`);
      return sendSMSViaArkesel(phone, message);
    }
    logger.info(`[SMS] NkomoSMS sent to ${phone}:`, JSON.stringify(res.data));
    return res.data;
  } catch (err) {
    logger.warn(`[SMS] NkomoSMS request failed (${err.response?.status}): ${err.response?.data ? JSON.stringify(err.response.data) : err.message} — trying Arkesel...`);
    return sendSMSViaArkesel(phone, message);
  }
};

const sendWhatsApp = async (to, message) => {
  if (!ARKESEL_API_KEY) {
    logger.warn('[WhatsApp] ARKESEL_API_KEY not set — skipping');
    return;
  }
  const phone = formatPhone(to);
  if (!phone) {
    logger.warn('[WhatsApp] Invalid phone:', to);
    return;
  }

  try {
    const res = await axios.post(
      'https://sms.arkesel.com/api/v2/sms/send',
      { sender: SENDER_ID, message, recipients: [phone], type: 'whatsapp' },
      { headers: { 'api-key': ARKESEL_API_KEY } }
    );
    logger.info(`[WhatsApp] Sent to ${phone}:`, JSON.stringify(res.data));
    return res.data;
  } catch (err) {
    logger.error(`[WhatsApp] Failed for ${phone}:`, err.response?.data || err.message);
  }
};

// ─── SMS functions ────────────────────────────────────────────────────────────

const sendAdminSaleSMS = async (adminPhone, sale) => {
  const branch = sale.branch ? `, ${sale.branch} Branch` : '';
  const freq   = sale.frequency === 'monthly' ? 'month' : sale.frequency === 'weekly' ? 'week' : 'day';
  const msg = `Tritech Hub Sale Alert\n${sale.deviceModel} sold by ${sale.staffName}${branch}.\nCustomer: ${sale.customerName} (${sale.customerPhone || 'N/A'})\nPrice: GHS ${Number(sale.totalPrice).toLocaleString()} | Down: GHS ${Number(sale.downPayment).toLocaleString()}\nPlan: GHS ${Number(sale.installmentAmount).toLocaleString()} x ${sale.totalPayments} payments/${freq}`;
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
  const msg = remainingBalance <= 0
    ? `Congratulations ${name}! Your ${deviceModel} is fully paid off. It is now yours! Thank you. -Tritech Hub`
    : `Hi ${name}, GHS ${Number(amount).toLocaleString()} received for your ${deviceModel}. Balance: GHS ${Number(remainingBalance).toLocaleString()}. -Tritech Hub`;
  await sendSMS(phone, msg);
};

const sendPasswordResetOTP = async (phone, otp) => {
  const msg = `Your TriTech Hub password reset code is: ${otp}. Valid for 10 minutes. Do not share this code. -Tritech Hub`;
  return sendSMS(phone, msg);
};

// ─── WhatsApp functions ───────────────────────────────────────────────────────

const sendAdminSaleWhatsApp = async (adminPhone, sale) => {
  const branch = sale.branch ? ` | Branch: ${sale.branch}` : '';
  const freq   = sale.frequency === 'monthly' ? 'month' : sale.frequency === 'weekly' ? 'week' : 'day';
  const msg = `*Tritech Hub — New Sale* 🎉\n\n*Staff:* ${sale.staffName}${branch}\n*Customer:* ${sale.customerName}\n*Phone:* ${sale.customerPhone || 'N/A'}\n*Device:* ${sale.deviceModel}\n*Price:* GHS ${Number(sale.totalPrice).toLocaleString()}\n*Down Payment:* GHS ${Number(sale.downPayment).toLocaleString()}\n*Plan:* GHS ${Number(sale.installmentAmount).toLocaleString()} × ${sale.totalPayments} payments/${freq}`;
  await sendWhatsApp(adminPhone, msg);
};

const sendPaymentReminderWhatsApp = async (phone, name, details) => {
  const { deviceModel, installmentAmount, remainingBalance, nextDueDate, isOverdue } = details;
  const due = nextDueDate ? new Date(nextDueDate).toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
  const msg = isOverdue
    ? `*Tritech Hub — Payment Overdue* ⚠️\n\nHi ${name}, your installment payment for your *${deviceModel}* is overdue.\n\n*Amount Due:* GHS ${Number(installmentAmount).toLocaleString()}\n*Due Date:* ${due}\n*Balance:* GHS ${Number(remainingBalance).toLocaleString()}\n\nPlease pay now at *tritechhub.online* to avoid your device being locked.`
    : `*Tritech Hub — Payment Reminder* 📅\n\nHi ${name}, your next installment for your *${deviceModel}* is coming up.\n\n*Amount:* GHS ${Number(installmentAmount).toLocaleString()}\n*Due Date:* ${due}\n*Balance:* GHS ${Number(remainingBalance).toLocaleString()}\n\nPay at *tritechhub.online*`;
  await sendWhatsApp(phone, msg);
};

const sendDeviceLockedWhatsApp = async (phone, name, deviceModel) => {
  const msg = `*Tritech Hub — Device Locked* 🔒\n\nHi ${name}, your *${deviceModel}* has been locked due to overdue payment.\n\nTo unlock your device, log in to *tritechhub.online* and make your payment. Your device will be unlocked within minutes.\n\nContact us if you need help.`;
  await sendWhatsApp(phone, msg);
};

const sendDeviceUnlockedWhatsApp = async (phone, name, deviceModel) => {
  const msg = `*Tritech Hub — Device Unlocked* ✅\n\nHi ${name}, your *${deviceModel}* has been unlocked. Thank you for your payment!\n\nKeep up with your installment schedule. Log in at *tritechhub.online* to view your balance.`;
  await sendWhatsApp(phone, msg);
};

const sendPlanCompletedWhatsApp = async (phone, name, deviceModel) => {
  const msg = `*Tritech Hub — Congratulations!* 🎉\n\nHi ${name}, you have fully paid for your *${deviceModel}*!\n\nThe device is now completely yours. Thank you for trusting Tritech Hub iOS.\n\nLog in at *tritechhub.online* to download your payment history.`;
  await sendWhatsApp(phone, msg);
};

const sendPaymentConfirmedWhatsApp = async (phone, name, amount, details) => {
  const { deviceModel, remainingBalance, reference } = details;
  const msg = remainingBalance <= 0
    ? `*Tritech Hub — Plan Complete!* 🎉\n\nCongratulations ${name}! Your *${deviceModel}* is now fully paid off!\n\nRef: ${reference || 'N/A'}\nTotal Paid: GHS ${Number(amount).toLocaleString()}\n\nThe device is yours. Thank you!`
    : `*Tritech Hub — Payment Received* ✅\n\nHi ${name}, we received your payment.\n\n*Amount:* GHS ${Number(amount).toLocaleString()}\n*Device:* ${deviceModel}\n*Balance Left:* GHS ${Number(remainingBalance).toLocaleString()}\n*Ref:* ${reference || 'N/A'}`;
  await sendWhatsApp(phone, msg);
};

module.exports = {
  sendSMS,
  sendWhatsApp,
  sendPasswordResetOTP,
  sendAdminSaleSMS,
  sendAdminSaleWhatsApp,
  sendCustomerWelcomeSMS,
  sendPaymentReminderSMS,
  sendPaymentReminderWhatsApp,
  sendDeviceLockedSMS,
  sendDeviceLockedWhatsApp,
  sendDeviceUnlockedSMS,
  sendDeviceUnlockedWhatsApp,
  sendPlanCompletedWhatsApp,
  sendPaymentConfirmedSMS,
  sendPaymentConfirmedWhatsApp,
};

