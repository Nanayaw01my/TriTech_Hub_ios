const axios = require('axios');

const logger = require('./logger');

// ── Arkesel (used for WhatsApp; kept as an optional SMS fallback) ──────────────
const ARKESEL_API_KEY = process.env.ARKESEL_API_KEY;
const SENDER_ID       = process.env.ARKESEL_SENDER_ID || 'DanDorsolar';

// ── NkomoSMS (primary SMS provider) ───────────────────────────────────────────
const NKOMO_API_TOKEN = process.env.NKOMOSMS_API_TOKEN;
const NKOMO_SENDER_ID = process.env.NKOMOSMS_SENDER_ID || 'DANDORSOLAR';
const NKOMO_SEND_URL  = 'https://app.nkomosms.com/api/http/sms/send';

const formatPhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '233' + digits.slice(1);
  if (digits.length === 9) return '233' + digits;
  return digits;
};

// ── Senders ──────────────────────────────────────────────────────────────────
// Each returns { ok, retry }. retry=false means "don't try the other provider"
// (sent, or a timeout where the message may already have gone out — retrying
// would double-send).
const sendSMSViaArkesel = async (phone, message) => {
  if (!ARKESEL_API_KEY) return { ok: false, retry: true, reason: 'ARKESEL_API_KEY not set' };
  try {
    const res = await axios.post(
      'https://sms.arkesel.com/api/v2/sms/send',
      { sender: SENDER_ID, message, recipients: [phone] },
      { headers: { 'api-key': ARKESEL_API_KEY }, timeout: 20000 }
    );
    if (res.data?.status === 'success') {
      logger.info(`[SMS] Arkesel sent to ${phone}: %s`, JSON.stringify(res.data));
      return { ok: true, retry: false };
    }
    logger.error(`[SMS] Arkesel rejected for ${phone}: %s`, JSON.stringify(res.data));
    return { ok: false, retry: true };
  } catch (err) {
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
      logger.warn(`[SMS] Arkesel slow to respond for ${phone} — assuming sent, NOT retrying (avoids double SMS)`);
      return { ok: false, retry: false };
    }
    logger.error(`[SMS] Arkesel failed for ${phone} (%s): %s`, err.response?.status || '-',
      err.response?.data ? JSON.stringify(err.response.data) : err.message);
    return { ok: false, retry: true };
  }
};

const sendSMSViaNkomo = async (phone, message) => {
  if (!NKOMO_API_TOKEN) return { ok: false, retry: true, reason: 'NKOMOSMS_API_TOKEN not set' };
  try {
    const res = await axios.post(
      NKOMO_SEND_URL,
      { api_token: NKOMO_API_TOKEN, recipient: phone, sender_id: NKOMO_SENDER_ID, type: 'plain', message },
      { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 30000 }
    );
    if (res.data && res.data.status === 'error') {
      logger.error(`[SMS] NkomoSMS rejected for ${phone}: %s`, res.data.message);
      return { ok: false, retry: true };
    }
    logger.info(`[SMS] NkomoSMS sent to ${phone}: %s`, JSON.stringify(res.data));
    return { ok: true, retry: false };
  } catch (err) {
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '')) {
      logger.warn(`[SMS] NkomoSMS slow to respond for ${phone} — assuming sent, NOT retrying (avoids double SMS)`);
      return { ok: false, retry: false };
    }
    logger.error(`[SMS] NkomoSMS failed for ${phone} (%s): %s`, err.response?.status || '-',
      err.response?.data ? JSON.stringify(err.response.data) : err.message);
    return { ok: false, retry: true };
  }
};

// ── Primary SMS sender: Arkesel first, NkomoSMS as the backup ──────────────────
// (Arkesel's sender name is approved on Ghana's networks; NkomoSMS reported
// "Delivered" for messages MTN never delivered.)
const sendSMS = async (to, message) => {
  const phone = formatPhone(to);
  if (!phone) {
    logger.warn('[SMS] Invalid phone: %s', to);
    return;
  }
  const first = await sendSMSViaArkesel(phone, message);
  if (first.ok || !first.retry) return first;
  const second = await sendSMSViaNkomo(phone, message);
  if (!second.ok && second.retry) {
    logger.error(`[SMS] NOT sent to ${phone}: both Arkesel and NkomoSMS failed or aren't set up.`);
  }
  return second;
};

// WhatsApp is opt-in. It's OFF by default because Arkesel delivers it as a
// plain SMS when WhatsApp isn't fully configured, which duplicates the SMS
// already sent via NkomoSMS. Set ENABLE_WHATSAPP=true once WhatsApp templates
// are approved on Arkesel to turn it back on.
const WHATSAPP_ENABLED = process.env.ENABLE_WHATSAPP === 'true';

const sendWhatsApp = async (to, message) => {
  if (!WHATSAPP_ENABLED) {
    return; // disabled — prevents duplicate messages alongside the NkomoSMS SMS
  }
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

// New sale registered by a DSR — alert the company number so it gets reviewed.
const sendAdminSaleSMS = async (adminPhone, sale) => {
  const branch = sale.branch ? `, ${sale.branch} Branch` : '';
  const freq   = sale.frequency === 'monthly' ? 'monthly' : sale.frequency === 'weekly' ? 'weekly' : 'daily';
  const msg = `Dan & Dor Solar - NEW SALE TO REVIEW\n${sale.deviceModel} by ${sale.staffName}${sale.staffId ? ` (${sale.staffId})` : ''}${branch}.\nCustomer: ${sale.customerName} (${sale.customerPhone || 'N/A'})\nPrice GHS ${Number(sale.totalPrice).toLocaleString()}, deposit GHS ${Number(sale.downPayment).toLocaleString()}\nPlan: ${sale.totalPayments} ${freq} x GHS ${Number(sale.installmentAmount).toLocaleString()}\nReview it in Activations.`;
  await sendSMS(adminPhone, msg);
};

// Sent once the sale is approved AND the deposit is paid (plan started): the
// customer's login plus what to pay and when.
const sendCustomerActivatedSMS = async (phone, name, d) => {
  const per = d.frequency === 'weekly' ? 'week' : d.frequency === 'monthly' ? 'month' : 'day';
  const due = d.firstDueDate ? new Date(d.firstDueDate).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const creds = d.pin ? `Acct ${d.accountNumber}, PIN ${d.pin}` : `Acct ${d.accountNumber} and your password`;
  const msg = `Congrats ${name}! Your ${d.deviceModel || 'phone'} plan is active. Pay GHS ${Number(d.installmentAmount).toLocaleString()} per ${per}${due ? `, first due ${due}` : ''}. Login at dandorsolar.site: ${creds}. -Dan & Dor Solar`;
  await sendSMS(phone, msg);
};

// The day before the due date: the phone locks tomorrow unless they pay.
const sendLockTomorrowSMS = async (phone, name, d) => {
  const due = d.dueDate ? new Date(d.dueDate).toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short' }) : 'tomorrow';
  const call = d.contact ? ` or call ${d.contact}` : '';
  const msg = `Hi ${name}, your payment of GHS ${Number(d.amount).toLocaleString()} is due tomorrow (${due}). Pay today at dandorsolar.site${call} to avoid your phone being locked. -Dan & Dor Solar`;
  await sendSMS(phone, msg);
};

// [pin] is included when the system generated the password (the DSR left it
// blank), otherwise the customer would have no way to know it.
const sendCustomerWelcomeSMS = async (phone, name, accountNumber, _url, pin = null) => {
  const creds = pin ? `Acct ${accountNumber} and PIN ${pin}` : `Acct ${accountNumber} and your password`;
  const msg = `Welcome ${name}! Login at dandorsolar.site with ${creds}. -Dan & Dor Solar`;
  await sendSMS(phone, msg);
};

const sendPaymentReminderSMS = async (phone, name, details) => {
  const { installmentAmount, nextDueDate, isOverdue } = details;
  const due = nextDueDate ? new Date(nextDueDate).toLocaleDateString('en-GH') : 'N/A';
  const msg = isOverdue
    ? `URGENT ${name}: GHS ${Number(installmentAmount).toLocaleString()} overdue (${due}). Pay now at dandorsolar.site to avoid lock. -Dan & Dor Solar`
    : `Hi ${name}, GHS ${Number(installmentAmount).toLocaleString()} due ${due}. Pay at dandorsolar.site -Dan & Dor Solar`;
  await sendSMS(phone, msg);
};

const sendDeviceLockedSMS = async (phone, name, deviceModel) => {
  const msg = `Hi ${name}, your ${deviceModel} has been locked. Pay at dandorsolar.site to unlock. -Dan & Dor Solar`;
  await sendSMS(phone, msg);
};

const sendDeviceUnlockedSMS = async (phone, name, deviceModel) => {
  const msg = `Hi ${name}, your ${deviceModel} has been unlocked. Thank you for your payment! -Dan & Dor Solar`;
  await sendSMS(phone, msg);
};

const sendPaymentConfirmedSMS = async (phone, name, amount, details) => {
  const { deviceModel, remainingBalance } = details;
  const msg = remainingBalance <= 0
    ? `Congratulations ${name}! Your ${deviceModel} is fully paid off. It is now yours! Thank you. -Dan & Dor Solar`
    : `Hi ${name}, GHS ${Number(amount).toLocaleString()} received for your ${deviceModel}. Balance: GHS ${Number(remainingBalance).toLocaleString()}. -Dan & Dor Solar`;
  await sendSMS(phone, msg);
};

const sendPasswordResetOTP = async (phone, otp) => {
  const msg = `Your Dan & Dor Solar password reset code is: ${otp}. Valid for 10 minutes. Do not share this code. -Dan & Dor Solar`;
  return sendSMS(phone, msg);
};

// ─── WhatsApp functions ───────────────────────────────────────────────────────

const sendAdminSaleWhatsApp = async (adminPhone, sale) => {
  const branch = sale.branch ? ` | Branch: ${sale.branch}` : '';
  const freq   = sale.frequency === 'monthly' ? 'month' : sale.frequency === 'weekly' ? 'week' : 'day';
  const msg = `*Dan & Dor Solar — New Sale* 🎉\n\n*Staff:* ${sale.staffName}${branch}\n*Customer:* ${sale.customerName}\n*Phone:* ${sale.customerPhone || 'N/A'}\n*Device:* ${sale.deviceModel}\n*Price:* GHS ${Number(sale.totalPrice).toLocaleString()}\n*Down Payment:* GHS ${Number(sale.downPayment).toLocaleString()}\n*Plan:* GHS ${Number(sale.installmentAmount).toLocaleString()} × ${sale.totalPayments} payments/${freq}`;
  await sendWhatsApp(adminPhone, msg);
};

const sendPaymentReminderWhatsApp = async (phone, name, details) => {
  const { deviceModel, installmentAmount, remainingBalance, nextDueDate, isOverdue } = details;
  const due = nextDueDate ? new Date(nextDueDate).toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
  const msg = isOverdue
    ? `*Dan & Dor Solar — Payment Overdue* ⚠️\n\nHi ${name}, your installment payment for your *${deviceModel}* is overdue.\n\n*Amount Due:* GHS ${Number(installmentAmount).toLocaleString()}\n*Due Date:* ${due}\n*Balance:* GHS ${Number(remainingBalance).toLocaleString()}\n\nPlease pay now at *dandorsolar.site* to avoid your device being locked.`
    : `*Dan & Dor Solar — Payment Reminder* 📅\n\nHi ${name}, your next installment for your *${deviceModel}* is coming up.\n\n*Amount:* GHS ${Number(installmentAmount).toLocaleString()}\n*Due Date:* ${due}\n*Balance:* GHS ${Number(remainingBalance).toLocaleString()}\n\nPay at *dandorsolar.site*`;
  await sendWhatsApp(phone, msg);
};

const sendDeviceLockedWhatsApp = async (phone, name, deviceModel) => {
  const msg = `*Dan & Dor Solar — Device Locked* 🔒\n\nHi ${name}, your *${deviceModel}* has been locked due to overdue payment.\n\nTo unlock your device, log in to *dandorsolar.site* and make your payment. Your device will be unlocked within minutes.\n\nContact us if you need help.`;
  await sendWhatsApp(phone, msg);
};

const sendDeviceUnlockedWhatsApp = async (phone, name, deviceModel) => {
  const msg = `*Dan & Dor Solar — Device Unlocked* ✅\n\nHi ${name}, your *${deviceModel}* has been unlocked. Thank you for your payment!\n\nKeep up with your installment schedule. Log in at *dandorsolar.site* to view your balance.`;
  await sendWhatsApp(phone, msg);
};

const sendPlanCompletedWhatsApp = async (phone, name, deviceModel) => {
  const msg = `*Dan & Dor Solar — Congratulations!* 🎉\n\nHi ${name}, you have fully paid for your *${deviceModel}*!\n\nThe device is now completely yours. Thank you for trusting Dan & Dor Solar Company Ltd.\n\nLog in at *dandorsolar.site* to download your payment history.`;
  await sendWhatsApp(phone, msg);
};

const sendPaymentConfirmedWhatsApp = async (phone, name, amount, details) => {
  const { deviceModel, remainingBalance, reference } = details;
  const msg = remainingBalance <= 0
    ? `*Dan & Dor Solar — Plan Complete!* 🎉\n\nCongratulations ${name}! Your *${deviceModel}* is now fully paid off!\n\nRef: ${reference || 'N/A'}\nTotal Paid: GHS ${Number(amount).toLocaleString()}\n\nThe device is yours. Thank you!`
    : `*Dan & Dor Solar — Payment Received* ✅\n\nHi ${name}, we received your payment.\n\n*Amount:* GHS ${Number(amount).toLocaleString()}\n*Device:* ${deviceModel}\n*Balance Left:* GHS ${Number(remainingBalance).toLocaleString()}\n*Ref:* ${reference || 'N/A'}`;
  await sendWhatsApp(phone, msg);
};

/**
 * Admin "Send test SMS": tries NkomoSMS, then Arkesel, and returns exactly what
 * each provider answered, so a misconfiguration (missing key, unapproved
 * sender ID, no credit) is visible instead of silent.
 */
const diagnoseSMS = async (to, message, only = null) => {
  const phone = formatPhone(to);
  const out = {
    phone,
    nkomo: { configured: !!NKOMO_API_TOKEN, sender_id: NKOMO_SENDER_ID },
    arkesel: { configured: !!ARKESEL_API_KEY, sender_id: SENDER_ID },
  };
  if (!phone) return { ...out, ok: false, error: 'Invalid phone number.' };

  // Same order as real messages: Arkesel first, NkomoSMS as backup.
  // only = 'nkomo' tests NkomoSMS directly; 'arkesel' skips the backup.
  if (ARKESEL_API_KEY && only !== 'nkomo') {
    try {
      const res = await axios.post(
        'https://sms.arkesel.com/api/v2/sms/send',
        { sender: SENDER_ID, message, recipients: [phone] },
        { headers: { 'api-key': ARKESEL_API_KEY }, timeout: 20000 }
      );
      out.arkesel.response = res.data;
      out.arkesel.ok = res.data?.status === 'success';
    } catch (err) {
      out.arkesel.ok = false;
      out.arkesel.http_status = err.response?.status || null;
      out.arkesel.error = err.response?.data || err.message;
    }
  }
  if (!out.arkesel.ok && NKOMO_API_TOKEN && only !== 'arkesel') {
    try {
      const res = await axios.post(
        NKOMO_SEND_URL,
        { api_token: NKOMO_API_TOKEN, recipient: phone, sender_id: NKOMO_SENDER_ID, type: 'plain', message },
        { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 30000 }
      );
      out.nkomo.response = res.data;
      out.nkomo.ok = !!res.data && res.data.status !== 'error';
    } catch (err) {
      out.nkomo.ok = false;
      out.nkomo.http_status = err.response?.status || null;
      out.nkomo.error = err.response?.data || err.message;
    }
  }
  out.ok = !!(out.arkesel.ok || out.nkomo.ok);
  out.provider = out.arkesel.ok ? 'Arkesel' : out.nkomo.ok ? 'NkomoSMS' : null;
  logger.info('[SMS] Test to %s: %s', phone, JSON.stringify(out));
  return out;
};

module.exports = {
  diagnoseSMS,
  sendCustomerActivatedSMS,
  sendLockTomorrowSMS,
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

