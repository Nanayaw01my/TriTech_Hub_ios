/**
 * Texts for the company (not the customer): new sales, due-soon lists, tamper
 * and silent-phone alerts, data-deletion requests.
 *
 * They go to the company number in Settings → Business Information (the one
 * shown on phones and the site) AND to any silent backup numbers set on the
 * server as SECONDARY_ALERT_PHONE (comma-separated for more than one). The
 * backup numbers are never shown anywhere; they only receive these texts.
 *
 * The Settings box may hold more than one number ("024… / 020…"); each one
 * gets the alert.
 */
const Settings = require('../models/Settings');
const sms = require('./sms');
const logger = require('./logger');

// A Ghana mobile number once normalised: 233 + 9 digits.
const isValid = (n) => /^233\d{9}$/.test(sms.formatPhone(n) || '');

// "0244000000 / 0201234567", "024 400 0000, 020…", "024… or 020…" → list.
function splitNumbers(text) {
  return String(text || '')
    .split(/\s*(?:[\/,;|&]|\bor\b|\band\b)\s*/i)
    .map((x) => x.trim())
    .filter(Boolean);
}

const mask = (n) => {
  const d = sms.formatPhone(n) || String(n);
  const local = d.startsWith('233') ? '0' + d.slice(3) : d;
  return local.length > 6 ? `${local.slice(0, 3)}•••${local.slice(-3)}` : local;
};

/**
 * [{ number, role: 'main' | 'backup', valid }] — every company alert number,
 * main first, duplicates removed.
 */
async function companyAlertTargets(fallback = null) {
  const s = await Settings.getSingleton().catch((e) => {
    logger.error('[alert] Could not read Settings: %s', e.message);
    return null;
  });
  const mainText = s?.contact_phone || process.env.ADMIN_PHONE || fallback || '';
  const main = splitNumbers(mainText).map((n) => ({ number: n, role: 'main' }));
  const backup = splitNumbers(process.env.SECONDARY_ALERT_PHONE).map((n) => ({ number: n, role: 'backup' }));
  const seen = new Set();
  const out = [];
  for (const t of [...main, ...backup]) {
    const key = sms.formatPhone(t.number) || t.number;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...t, valid: isValid(t.number) });
  }
  return out;
}

async function companyAlertNumbers(fallback = null) {
  return (await companyAlertTargets(fallback)).filter((t) => t.valid).map((t) => t.number);
}

/** Send [message] to every company alert number. Returns how many went out. */
async function sendCompanyAlert(message, { fallback = null, tag = 'alert' } = {}) {
  const targets = await companyAlertTargets(fallback);
  if (!targets.some((t) => t.role === 'main')) {
    logger.warn(`[${tag}] No company phone in Settings → Business Information; only backup numbers get this alert.`);
  }
  let sent = 0;
  const report = [];
  for (const t of targets) {
    if (!t.valid) {
      logger.error(`[${tag}] Skipped ${t.role} number "${t.number}": not a valid Ghana phone number. Fix it in Settings.`);
      report.push(`${t.role} ${t.number}: invalid`);
      continue;
    }
    try {
      const r = await sms.sendSMS(t.number, message);
      if (r && r.ok) sent += 1;
      report.push(`${t.role} ${mask(t.number)}: ${r && r.ok ? 'sent' : 'NOT sent'}`);
    } catch (e) {
      report.push(`${t.role} ${mask(t.number)}: error ${e.message}`);
      logger.error(`[${tag}] SMS to ${t.role} number failed: %s`, e.message);
    }
  }
  logger.info(`[${tag}] Company alert: ${sent}/${targets.length} sent (${report.join('; ') || 'no numbers'})`);
  return sent;
}

module.exports = { companyAlertNumbers, companyAlertTargets, sendCompanyAlert, splitNumbers, mask };
