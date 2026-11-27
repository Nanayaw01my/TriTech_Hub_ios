/**
 * Watch sold phones for signs of tampering and text the company.
 *
 * What Android lets us see:
 * - A phone under a plan that stops checking in. This is what a flash
 *   (re-installing the phone's software with a computer), a recovery-mode
 *   reset, or a phone kept switched off looks like: our app is gone or not
 *   running, so it goes silent. We text the company once, and again when it
 *   comes back.
 * - Events the phone app reports itself: being switched off (recorded so the
 *   silent alert can say when), and an attempt to remove the app's admin rights.
 *
 * Uninstalling the app or resetting from Settings is blocked by Android itself
 * (the app is the Device Owner); Android doesn't tell the app about those
 * attempts, so they can't be reported. A flash wipes the app, which is why
 * it shows up as "silent".
 */
const Device = require('../models/Device');
const InstallmentPlan = require('../models/InstallmentPlan');
const Customer = require('../models/Customer');
const { sendCompanyAlert } = require('./companyAlert');
const logger = require('./logger');

const STARTED_AT = Date.now();
const silentHours = () => {
  const h = Number(process.env.SILENT_ALERT_HOURS);
  return Number.isFinite(h) && h >= 2 ? h : 24;
};

const when = (d) => (d ? new Date(d).toLocaleString('en-GH', {
  timeZone: 'Africa/Accra', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
}) : 'never');

const mapLink = (loc) => (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)
  ? `https://maps.google.com/?q=${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`
  : null);

async function describe(device) {
  if (device.kind === 'staff') {
    const User = require('../models/User');
    const u = device.used_by ? await User.findById(device.used_by).select('name staff_id phone').lean() : null;
    const phone = `staff phone ${device.model || ''}${device.imei ? ` (IMEI ${device.imei})` : ''}`.replace(/\s+/g, ' ').trim();
    const who = u ? `${u.name}${u.staff_id ? ` (${u.staff_id})` : ''}${u.phone ? ` ${u.phone}` : ''}` : 'no staff member set';
    return { plan: null, customer: null, phone, who, staff: true };
  }
  const plan = await InstallmentPlan.findOne({ device_id: device._id, status: { $in: ['active', 'defaulted', 'approved'] } })
    .sort({ createdAt: -1 }).select('customer_id status').lean();
  const customer = plan?.customer_id
    ? await Customer.findById(plan.customer_id).select('full_name phone').lean()
    : null;
  const phone = `${device.model || 'Phone'}${device.imei ? ` (IMEI ${device.imei})` : ''}`;
  const who = customer ? `${customer.full_name}${customer.phone ? ` ${customer.phone}` : ''}` : 'no customer';
  return { plan, customer, phone, who };
}

/** Hourly: text the company about phones under a plan that went silent. */
async function checkSilentPhones() {
  // Right after a restart the phones haven't had a chance to check in yet.
  if (Date.now() - STARTED_AT < 60 * 60 * 1000) return 0;
  const hours = silentHours();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const plans = await InstallmentPlan.find({ status: { $in: ['active', 'defaulted'] }, device_id: { $ne: null } })
    .select('device_id').lean();
  const ids = plans.map((p) => p.device_id);
  const devices = await Device.find({
    $or: [{ _id: { $in: ids } }, { kind: 'staff' }],
    'agent.enrolled': true,
    'agent.enrollment_status': 'enrolled',
    'agent.last_heartbeat': { $lt: cutoff },
    'agent.silent_alert_at': null,
  }).setOptions({ includeStaff: true });
  let n = 0;
  for (const device of devices) {
    try {
      const d = await describe(device);
      const off = device.agent.last_shutdown_at && device.agent.last_shutdown_at >= device.agent.last_heartbeat - 60 * 1000
        ? ` It was switched off at ${when(device.agent.last_shutdown_at)}.`
        : '';
      const map = mapLink(device.agent.location);
      const msg = `ALERT Dan & Dor Solar: ${d.phone} ${d.staff ? 'used by' : 'sold to'} ${d.who} has not checked in for over ${hours}h. Last seen ${when(device.agent.last_heartbeat)}.${off} It may be off, without data/Wi-Fi, or reset/flashed.${map ? ` Last location: ${map}` : ''}`;
      device.agent.silent_alert_at = new Date();
      await device.save();
      await sendCompanyAlert(msg, { tag: 'silent-phone' });
      n += 1;
    } catch (e) {
      logger.error('[silent-phone] %s', e.message);
    }
  }
  if (n) logger.info('[silent-phone] %d silent phone alert(s) sent.', n);
  return n;
}

/** Called on a check-in: if we'd raised a silent alert, say it's back. */
async function noteBackOnline(device) {
  if (!device?.agent?.silent_alert_at) return;
  const since = device.agent.last_heartbeat;
  device.agent.silent_alert_at = null;
  try {
    const d = await describe(device);
    await sendCompanyAlert(
      `Dan & Dor Solar: ${d.phone} (${d.who}) is back online. It was silent since ${when(since)}.`,
      { tag: 'silent-phone' },
    );
  } catch (e) {
    logger.error('[silent-phone] back-online alert: %s', e.message);
  }
}

const EVENT_TEXT = {
  admin_disable_attempt: 'someone tried to remove the Dan & Dor app\'s control of the phone (blocked)',
};

/**
 * An event the phone app reported. Returns true when the company was texted.
 * Repeats of the same event within an hour are not texted again.
 */
async function handleDeviceEvent(device, type, detail, at) {
  const t = String(type || '').slice(0, 40);
  const time = at && Number(at) > 0 ? new Date(Number(at)) : new Date();
  if (t === 'shutdown') {
    device.agent.last_shutdown_at = time;
    return false;
  }
  if (!EVENT_TEXT[t]) return false;
  const last = device.agent.last_tamper;
  if (last?.type === t && last.at && Date.now() - new Date(last.at).getTime() < 60 * 60 * 1000) {
    device.agent.last_tamper = { type: t, at: time, detail: String(detail || '').slice(0, 200) };
    return false;
  }
  device.agent.last_tamper = { type: t, at: time, detail: String(detail || '').slice(0, 200) };
  const d = await describe(device);
  const map = mapLink(device.agent.location);
  await sendCompanyAlert(
    `ALERT Dan & Dor Solar: on ${d.phone} ${d.staff ? 'used by' : 'sold to'} ${d.who}, ${EVENT_TEXT[t]} at ${when(time)}.${map ? ` Location: ${map}` : ''}`,
    { tag: 'tamper' },
  );
  return true;
}

const simText = (sims) => (sims && sims.length
  ? sims.map((x) => `${x.carrier || 'SIM'}${x.number ? ` ${x.number}` : ''}${x.slot != null ? ` (slot ${Number(x.slot) + 1})` : ''}`).join(', ')
  : 'no SIM');

/**
 * Phone status from a check-in (app 1.141+): battery, network and SIM cards.
 * A SIM removed, put in or swapped on a STAFF phone texts the company (at most
 * every 30 minutes). Sold phones only record it (customers change SIMs).
 */
async function noteStatus(device, status) {
  if (!status || typeof status !== 'object') return false;
  const sims = (Array.isArray(status.sims) ? status.sims : []).slice(0, 4).map((x) => ({
    slot: Number.isFinite(Number(x?.slot)) ? Number(x.slot) : 0,
    carrier: String(x?.carrier || '').slice(0, 40),
    number: String(x?.number || '').replace(/[^\d+]/g, '').slice(0, 16),
    iccid_tail: String(x?.iccid_tail || '').replace(/[^0-9A-Za-z]/g, '').slice(-6),
  }));
  const battery = Number(status.battery);
  device.agent.status = {
    battery: Number.isFinite(battery) && battery >= 0 && battery <= 100 ? Math.round(battery) : null,
    charging: typeof status.charging === 'boolean' ? status.charging : null,
    network: status.network ? String(status.network).slice(0, 20) : null,
    sims,
    at: new Date(),
  };
  if (typeof status.sim_key !== 'string') return false;
  const key = status.sim_key.slice(0, 64);
  const prev = device.agent.sim_key;
  if (prev === key) return false;
  device.agent.sim_key = key;
  if (prev === null || prev === undefined) return false; // first report from this phone
  const now = new Date();
  device.agent.sim_changed_at = now;
  device.agent.sim_history = [...(device.agent.sim_history || []), { at: now, sims: simText(sims) }].slice(-10);
  if (device.kind !== 'staff') return false;
  if (device.agent.sim_alert_at && Date.now() - new Date(device.agent.sim_alert_at).getTime() < 30 * 60 * 1000) return false;
  device.agent.sim_alert_at = now;
  const d = await describe(device);
  const what = !key ? 'SIM card REMOVED' : !prev ? 'SIM card put in' : 'SIM card CHANGED';
  const map = mapLink(device.agent.location);
  await sendCompanyAlert(
    `ALERT Dan & Dor Solar: ${what} on ${d.phone} used by ${d.who} at ${when(now)}. Now: ${simText(sims)}.${map ? ` Location: ${map}` : ''}`,
    { tag: 'sim-change' },
  );
  return true;
}

module.exports = { checkSilentPhones, noteBackOnline, handleDeviceEvent, noteStatus, simText };
