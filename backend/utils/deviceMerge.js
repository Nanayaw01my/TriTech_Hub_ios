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

const OPEN_SALE = ['pending', 'returned', 'approved', 'active', 'defaulted'];

/**
 * Move a sale that points at a plain "copy" of a phone (a non-enrolled record
 * with the same IMEI, made by duplicate sales) onto the REAL enrolled phone,
 * then delete the copy. Returns true if the sale was moved.
 */
async function relinkSaleToEnrolledPhone(plan, enrolled) {
  if (!plan || !enrolled?.agent?.enrolled) return false;
  if (String(plan.device_id) === String(enrolled._id)) return false;
  // The real phone mustn't be in another open sale already.
  const busy = await InstallmentPlan.exists({ _id: { $ne: plan._id }, device_id: enrolled._id, status: { $in: OPEN_SALE } });
  if (busy) return false;
  const copyId = plan.device_id;
  await InstallmentPlan.updateOne({ _id: plan._id }, { $set: { device_id: enrolled._id } });

  enrolled.assigned_to = plan.customer_id;
  enrolled.sold_status = 'sold';
  if (['active', 'defaulted'].includes(plan.status)) {
    const overdue = plan.status === 'defaulted' || (plan.next_due_date && new Date(plan.next_due_date) < new Date());
    enrolled.agent.desired_lock_state = overdue ? 'locked' : 'unlocked';
    enrolled.agent.paid_until = require('./androidAgent').computePaidUntil(plan.next_due_date);
    if (overdue) enrolled.lock_status = 'locked';
  } else {
    enrolled.agent.desired_lock_state = 'pending_activation';
  }
  await enrolled.save();

  // Remove the copy if nothing else uses it.
  if (copyId && !(await InstallmentPlan.exists({ device_id: copyId }))) {
    await Device.deleteOne({ _id: copyId, 'agent.enrolled': { $ne: true } }).catch(() => {});
  }
  logger.info('[merge] Sale %s moved from copy %s to enrolled phone %s', plan._id, copyId, enrolled._id);
  return true;
}

/**
 * Find open sales linked to a non-enrolled copy of an enrolled phone (same
 * IMEI) and move them onto the real phone. Active sales win over pending ones.
 */
async function relinkCopiesToEnrolledPhones() {
  const enrolledPhones = await Device.find({ 'agent.enrolled': true, imei: { $nin: [null, ''] } });
  let moved = 0;
  for (const phone of enrolledPhones) {
    // Already serving an active sale? Leave it.
    if (await InstallmentPlan.exists({ device_id: phone._id, status: { $in: ['active', 'defaulted'] } })) continue;
    const copies = await Device.find({ _id: { $ne: phone._id }, imei: phone.imei, 'agent.enrolled': { $ne: true } }).select('_id').lean();
    if (!copies.length) continue;
    const ids = copies.map((c) => c._id);
    const plans = await InstallmentPlan.find({ device_id: { $in: ids }, status: { $in: OPEN_SALE } }).sort({ activated_at: -1, createdAt: 1 });
    // Only sales whose customer still exists.
    const Customer = require('../models/Customer');
    let target = null;
    for (const p of plans.sort((a, b) => (['active', 'defaulted'].includes(b.status) ? 1 : 0) - (['active', 'defaulted'].includes(a.status) ? 1 : 0))) {
      if (await Customer.exists({ _id: p.customer_id, deleted_at: null })) { target = p; break; }
    }
    if (target && await relinkSaleToEnrolledPhone(target, phone)) {
      moved++;
      try { await require('./androidAgent').pushCommand(phone); } catch { /* next check-in */ }
    }
  }
  if (moved) logger.info('[merge] Moved %d sale(s) from phone copies to their enrolled phones.', moved);
  return { moved };
}

module.exports = { mergeDevicesByImei, mergeAllDuplicates, relinkSaleToEnrolledPhone, relinkCopiesToEnrolledPhones };
