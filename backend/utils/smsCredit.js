/**
 * Daily SMS credit check. If the Arkesel balance falls below the level set in
 * Settings (default 200 SMS), the company numbers get a text (at most once a
 * day) so reminders and lock texts never stop silently.
 */
const Settings = require('../models/Settings');
const { getArkeselBalance } = require('./sms');
const { sendCompanyAlert } = require('./companyAlert');
const logger = require('./logger');

async function checkSmsCredit({ alert = true } = {}) {
  const value = await getArkeselBalance();
  const s = await Settings.getSingleton();
  if (value === null) {
    logger.warn('[sms-credit] Could not read the Arkesel balance.');
    return { value: null, low: null, threshold: s.sms_low_balance };
  }
  const threshold = Number(s.sms_low_balance ?? 200);
  const low = value < threshold;
  const prev = s.sms_balance || {};
  const update = { 'sms_balance.value': value, 'sms_balance.at': new Date() };
  const lastAlert = prev.alerted_at ? new Date(prev.alerted_at).getTime() : 0;
  if (alert && low && Date.now() - lastAlert > 20 * 60 * 60 * 1000) {
    await sendCompanyAlert(
      `ALERT Dan & Dor Solar: SMS credit is low - ${Math.floor(value)} left (warning level ${threshold}). Top up Arkesel now, or reminders and lock texts will stop.`,
      { tag: 'sms-credit' },
    );
    update['sms_balance.alerted_at'] = new Date();
  }
  await Settings.updateOne({ _id: s._id }, { $set: update });
  logger.info('[sms-credit] Arkesel balance %s (warning below %s)%s', value, threshold, low ? ' — LOW' : '');
  return { value, low, threshold };
}

module.exports = { checkSmsCredit };
