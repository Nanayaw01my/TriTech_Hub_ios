/**
 * Texts for the company (not the customer): new sales, tamper and silent-phone
 * alerts, data-deletion requests.
 *
 * They go to the company number in Settings → Business Information (the one
 * shown on phones and the site) AND to any silent backup numbers set on the
 * server as SECONDARY_ALERT_PHONE (comma-separated for more than one). The
 * backup numbers are never shown anywhere; they only receive these texts.
 */
const Settings = require('../models/Settings');
const { sendSMS, formatPhone } = require('./sms');
const logger = require('./logger');

async function companyAlertNumbers(fallback = null) {
  const s = await Settings.getSingleton().catch(() => null);
  const primary = s?.contact_phone || process.env.ADMIN_PHONE || fallback || null;
  const extra = String(process.env.SECONDARY_ALERT_PHONE || '')
    .split(/[,;\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const n of [primary, ...extra]) {
    if (!n) continue;
    const key = formatPhone(n);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

/** Send [message] to every company alert number. Returns how many went out. */
async function sendCompanyAlert(message, { fallback = null, tag = 'alert' } = {}) {
  const numbers = await companyAlertNumbers(fallback);
  if (!numbers.length) {
    logger.warn(`[${tag}] No company phone set (Settings → Business Information) — alert not sent.`);
    return 0;
  }
  let sent = 0;
  for (const n of numbers) {
    try {
      const r = await sendSMS(n, message);
      if (r && r.ok) sent += 1;
    } catch (e) {
      logger.error(`[${tag}] SMS to company number failed: %s`, e.message);
    }
  }
  logger.info(`[${tag}] Company alert sent to ${sent}/${numbers.length} number(s).`);
  return sent;
}

module.exports = { companyAlertNumbers, sendCompanyAlert };
