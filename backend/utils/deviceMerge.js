/**
 * Merge enrolled Device records that are the same physical phone (same IMEI).
 *
 * A factory reset gives a phone a new Android ID, so re-enrolling it used to
 * create a second record. The IMEI doesn't change, so records sharing one are
 * merged into a single record:
 *   - keep the one sold to a customer (if any), else the most recently seen;
 *   - give it the phone's current connection (agent id/secret/heartbeat…) from
 *     the most recently seen copy, so lock/unlock keep reaching the phone;
 *   - keep its business state (customer, lock wish, deadline, price, holder);
 *   - delete the other copies, or just detach them if an old sale refers to them.
 */
const Device = require('../models/Device');
const InstallmentPlan = require('../models/InstallmentPlan');
const logger = require('./logger');

const AGENT_IDENTITY = [
  'enrolled', 'device_id', 'device_secret', 'enrollment_token', 'enrollment_status',
  'fcm_token', 'last_heartbeat', 'app_version', 'android_version', 'model_reported', 'location',
];

const seenAt = (d) => (d.agent?.last_heartbeat ? new Date(d.agent.last_heartbeat).getTime() : 0);

/** Merge every enrolled record with this IMEI. Returns the kept record (or null). */
async function mergeDevicesByImei(imei) {
  const clean = imei && String(imei).trim();
  if (!clean) return null;
  const copies = await Device.find({ imei: clean, 'agent.enrolled': true });
  if (copies.length < 2) return copies[0] || null;

  const sold = copies.filter((d) => d.assigned_to);
  if (sold.length > 1) {
    logger.warn('[merge] IMEI %s is on %d sold records — left for manual review.', clean, sold.length);
    return null;
  }
  const newest = copies.reduce((a, b) => (seenAt(b) > seenAt(a) ? b : a));
  const keep = sold[0] || newest;

  // Detach/delete the other copies first, so two records never share the
  // phone's agent id (check-ins look the phone up by that id).
  // Stock details (admin price, DSR holding it) can sit on any copy.
  const others = copies.filter((d) => String(d._id) !== String(keep._id));
  const priced = others.find((d) => d.price_set_by_admin && d.price > 0);
  const held = others.find((d) => d.held_by);

  let removed = 0;
  for (const d of others) {
    const referenced = await InstallmentPlan.exists({ device_id: d._id });
    if (referenced) {
      d.agent.enrolled = false;
      d.agent.enrollment_status = 'released';
      d.agent.device_id = null;
      d.agent.device_secret = null;
      d.agent.fcm_token = null;
      await d.save();
    } else {
      await Device.deleteOne({ _id: d._id });
    }
    removed++;
  }

  if (String(newest._id) !== String(keep._id)) {
    for (const f of AGENT_IDENTITY) keep.agent[f] = newest.agent[f];
  }
  if (!keep.assigned_to) {
    if (!keep.held_by && held) { keep.held_by = held.held_by; keep.held_since = held.held_since; }
    if (!keep.price_set_by_admin && priced) { keep.price = priced.price; keep.price_set_by_admin = true; }
  }
  await keep.save();

  logger.info('[merge] IMEI %s: kept %s, merged %d duplicate(s).', clean, keep._id, removed);
  return keep;
}

/** Merge all duplicate IMEIs. Returns { groups, removed }. */
async function mergeAllDuplicates() {
  const dupes = await Device.aggregate([
    { $match: { 'agent.enrolled': true, imei: { $nin: [null, ''] } } },
    { $group: { _id: '$imei', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  let removed = 0;
  for (const g of dupes) {
    const before = g.n;
    const kept = await mergeDevicesByImei(g._id);
    if (kept) removed += before - 1;
  }
  return { groups: dupes.length, removed };
}

module.exports = { mergeDevicesByImei, mergeAllDuplicates };
