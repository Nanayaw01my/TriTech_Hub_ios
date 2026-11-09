/**
 * Device-facing endpoints for the Android lock agent (Device Owner app).
 * These are NOT behind the normal JWT auth — the phone authenticates with a
 * one-time enrollment token (to enroll) and then a per-device secret.
 */
const crypto = require('crypto');
const Device = require('../models/Device');
const Customer = require('../models/Customer');
const InstallmentPlan = require('../models/InstallmentPlan');
const AuditLog = require('../models/AuditLog');
const LocationPing = require('../models/LocationPing');
const Settings = require('../models/Settings');
const logger = require('../utils/logger');
const agent = require('../utils/androidAgent');
const { mergeDevicesByImei } = require('../utils/deviceMerge');
const { noteBackOnline, handleDeviceEvent } = require('../utils/tamperWatch');

const POLL_INTERVAL_SECONDS = Number(process.env.AGENT_POLL_SECONDS || 900);

function safeEqual(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Self-heal the phone's state from its real sale. If the phone is still on the
 * "Awaiting Activation" page (or held as stock) but one of its sales is
 * already ACTIVE (deposit paid) — e.g. after duplicate sales were made and
 * deleted — show the right state now: unlocked, or locked if overdue.
 */
async function reconcileWithSale(device) {
  try {
    if (device.agent?.desired_lock_state !== 'pending_activation') return false;
    // A sale may point at a plain copy of this phone (same IMEI) made by
    // duplicate sales — move it onto this real phone first.
    if (device.imei && !(await InstallmentPlan.exists({ device_id: device._id, status: { $in: ['active', 'defaulted'] } }))) {
      const copies = await Device.find({ _id: { $ne: device._id }, imei: device.imei, 'agent.enrolled': { $ne: true } }).select('_id').lean();
      if (copies.length) {
        const copyPlan = await InstallmentPlan.findOne({ device_id: { $in: copies.map((c) => c._id) }, status: { $in: ['active', 'defaulted'] } })
          .sort({ activated_at: -1 });
        if (copyPlan && await Customer.exists({ _id: copyPlan.customer_id, deleted_at: null })) {
          await require('../utils/deviceMerge').relinkSaleToEnrolledPhone(copyPlan, device);
        }
      }
    }
    const plan = await InstallmentPlan.findOne({
      device_id: device._id,
      status: { $in: ['active', 'defaulted'] },
    }).sort({ activated_at: -1, createdAt: -1 });
    if (!plan) return false;
    const customer = await Customer.findOne({ _id: plan.customer_id, deleted_at: null }).select('_id').lean();
    if (!customer) return false;
    const overdue = plan.status === 'defaulted' || (plan.next_due_date && new Date(plan.next_due_date) < new Date());
    device.assigned_to = customer._id;
    device.sold_status = 'sold';
    device.agent.desired_lock_state = overdue ? 'locked' : 'unlocked';
    device.agent.paid_until = agent.computePaidUntil(plan.next_due_date);
    if (overdue) device.lock_status = 'locked';
    logger.info('[agent] Reconciled device %s with active plan %s -> %s', device._id, plan._id, device.agent.desired_lock_state);
    return true;
  } catch (err) {
    logger.warn('[agent] reconcile failed for %s: %s', device._id, err.message);
    return false;
  }
}

/** Resolve the unlock contact + a tailored lock message for a device. */
async function lockInfoFor(device) {
  let contact = agent.config.BUSINESS_PHONE;
  try {
    if (device.assigned_to) {
      const c = await Customer.findById(device.assigned_to).select('full_name').lean();
      if (c) { /* reserved for future personalization */ }
    }
  } catch { /* ignore */ }
  const released = device.agent?.desired_lock_state === 'released' || device.agent?.enrollment_status === 'released';
  // FRP accounts for the phone to enforce ([] = switch FRP off, e.g. on release).
  let frpAccounts = [];
  if (!released) {
    try {
      const s = await Settings.getSingleton();
      frpAccounts = (s.frp_accounts || []).map((a) => a.google_id).filter(Boolean);
    } catch { /* keep [] */ }
  }
  return {
    ...(agent.agentUpdateInfo() || {}),
    frp_accounts: frpAccounts,
    desired_lock_state: device.agent?.desired_lock_state || 'unlocked',
    lock_message: agent.lockMessage(),
    business_name: agent.config.BUSINESS_NAME,
    unlock_contact: contact,
    poll_interval: POLL_INTERVAL_SECONDS,
    // Offline self-lock deadline as epoch millis (0 = no deadline). The phone
    // stores this and locks itself once its own clock passes it, even with no
    // internet.
    paid_until: device.agent?.paid_until ? new Date(device.agent.paid_until).getTime() : 0,
    // Dead-man switch: if the phone (on an active plan) can't check in for this
    // many days, it locks itself — stops a customer from dodging commands by
    // keeping the phone permanently offline. 0 disables it.
    deadman_days: Number(process.env.DEADMAN_DAYS) || 7,
  };
}

/**
 * POST /api/agent/enroll
 * Called once, right after Device Owner provisioning. Body carries the
 * enrollment token (from the provisioning QR) plus device facts.
 */
const enroll = async (req, res) => {
  try {
    const { enrollment_token, device_id, imei, fcm_token, android_version, app_version, model } = req.body || {};
    if (!enrollment_token || !device_id) {
      return res.status(400).json({ success: false, message: 'enrollment_token and device_id are required.' });
    }

    // Two enrollment paths:
    //  - STOCK: the reusable stock token enrols any phone into the unassigned
    //    inventory pool (creating a Device record keyed by the phone's id).
    //  - PER-SALE: a one-time token already attached to a specific Device.
    const settings = await Settings.getSingleton();
    const isStock = settings.stock_enrollment_token && enrollment_token === settings.stock_enrollment_token;

    let device;
    if (isStock) {
      device = await Device.findOne({ 'agent.device_id': device_id });
      // A factory reset gives the phone a new id, but the IMEI is the same:
      // reuse its existing record instead of creating a duplicate.
      if (!device && imei) {
        device = await Device.findOne({ imei: String(imei).trim(), 'agent.enrolled': true })
          .sort({ assigned_to: -1, 'agent.last_heartbeat': -1 });
      }
      if (!device) {
        device = new Device({
          model: model || 'Android phone',
          price: 0,
          imei: imei || undefined,
          sold_status: 'available',
          assigned_to: null,
          agent: {},
        });
      }
    } else {
      device = await Device.findOne({ 'agent.enrollment_token': enrollment_token });
      if (!device) {
        return res.status(404).json({ success: false, message: 'Invalid or expired enrollment token.' });
      }
      if (device.agent?.enrollment_status === 'revoked') {
        return res.status(403).json({ success: false, message: 'This enrollment has been revoked.' });
      }
    }
    if (!device.agent) device.agent = {};

    const device_secret = agent.generateDeviceSecret();
    device.agent.enrolled = true;
    device.agent.enrollment_status = 'enrolled';
    device.agent.device_id = device_id;
    device.agent.device_secret = device_secret;
    device.agent.rejected_at = null;
    device.agent.rekey_until = null;
    if (fcm_token) device.agent.fcm_token = fcm_token;
    if (android_version) device.agent.android_version = android_version;
    if (app_version) device.agent.app_version = app_version;
    if (model) device.agent.model_reported = model;
    if (imei && !device.imei) device.imei = imei;
    device.agent.last_heartbeat = new Date();

    // Until the admin activates a sale for this phone it shows the "Awaiting
    // Activation" first page: stock phones (unassigned) and phones whose sale
    // is still pending. Activation (activatePlan) releases it.
    // An active (deposit-paid) sale on this phone always wins — a newer
    // duplicate sale still awaiting approval must not put it back on hold.
    let awaiting = !device.assigned_to;
    if (!awaiting) {
      const activePlan = await InstallmentPlan.exists({ device_id: device._id, status: { $in: ['active', 'defaulted'] } });
      if (!activePlan) {
        const plan = await InstallmentPlan.findOne({ device_id: device._id }).sort({ createdAt: -1 }).lean();
        awaiting = ['pending', 'returned', 'approved'].includes(plan?.status);
      }
    }
    if (awaiting) {
      device.agent.desired_lock_state = 'pending_activation';
      device.agent.paid_until = null;
    }
    await device.save();

    await AuditLog.create({
      action: 'agent_enroll',
      details: { device_id: device._id, agent_device_id: device_id, model: device.model, imei },
      ip_address: req.ip,
    }).catch(() => {});

    // Fold any older records of this same phone (same IMEI) into one.
    if (device.imei) {
      const kept = await mergeDevicesByImei(device.imei);
      if (kept) device = kept;
    }

    logger.info('[agent] Enrolled device %s (agent id %s)', device._id, device_id);
    const info = await lockInfoFor(device);
    return res.status(200).json({ success: true, device_secret, ...info });
  } catch (error) {
    logger.error('[agent] enroll error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/** Shared auth for post-enrollment calls: x-device-id + x-device-secret. */
async function authDevice(req, res) {
  const id = req.headers['x-device-id'];
  const secret = req.headers['x-device-secret'];
  if (!id || !secret) {
    res.status(401).json({ success: false, message: 'Missing device credentials.' });
    return null;
  }
  const device = await Device.findOne({ 'agent.device_id': id });
  if (device && !safeEqual(device.agent?.device_secret, secret)) {
    // The admin pressed "Reconnect phone": take the key this phone has.
    if (device.agent?.rekey_until && new Date(device.agent.rekey_until) > new Date() && String(secret).length >= 16) {
      device.agent.device_secret = String(secret);
      device.agent.rekey_until = null;
      device.agent.rejected_at = null;
      await device.save();
      logger.info('[agent] Phone %s reconnected (record %s) — its key is now the saved one.', String(id).slice(-6), device._id);
      AuditLog.create({ action: 'agent_enroll', details: { event: 'reconnected', device_id: device._id }, ip_address: req.ip }).catch(() => {});
      return device;
    }
    // Remember it, so the customer page can offer "Reconnect phone".
    Device.updateOne({ _id: device._id }, { $set: { 'agent.rejected_at': new Date() } }).catch(() => {});
  }
  if (!device || !safeEqual(device.agent?.device_secret, secret)) {
    // A phone that is online but can't check in shows up here.
    logger.warn('[agent] Rejected check-in from phone %s: %s', String(id).slice(-6),
      device ? `wrong secret (record ${device._id}, ${device.model || ''} ${device.imei || ''})` : 'no phone record with this id');
    res.status(401).json({ success: false, message: 'Invalid device credentials.' });
    return null;
  }
  if (device.agent?.rejected_at) device.agent.rejected_at = null;
  return device;
}

/**
 * POST /api/agent/heartbeat
 * The agent checks in, reports its applied state + fcm token, and receives the
 * desired state back. This is also the poll fallback when FCM is unavailable.
 */
const heartbeat = async (req, res) => {
  try {
    const device = await authDevice(req, res);
    if (!device) return;
    const { fcm_token, lock_state, android_version, app_version, lat, lng, accuracy, loc_at, imei,
      version_code, frp_status, update_error } = req.body || {};
    if (Number(version_code) > 0) device.agent.version_code = Number(version_code);
    if (typeof frp_status === 'string') device.agent.frp_status = frp_status.slice(0, 40);
    if (update_error !== undefined) device.agent.update_error = update_error ? String(update_error).slice(0, 200) : null;
    const newImei = imei && !device.imei ? String(imei).trim() : null;
    if (newImei) device.imei = newImei;
    await noteBackOnline(device);
    device.agent.last_heartbeat = new Date();
    if (fcm_token && fcm_token !== device.agent.fcm_token) device.agent.fcm_token = fcm_token;
    if (android_version) device.agent.android_version = android_version;
    if (app_version) device.agent.app_version = app_version;
    // Trust the agent's report of what it actually applied.
    if (lock_state === 'locked' || lock_state === 'unlocked') device.lock_status = lock_state;
    if (['pending', 'locked', 'unlocked', 'released', 'release_pending'].includes(lock_state)) {
      device.agent.applied_state = lock_state;
    }

    // Store the phone's location (last-known on the device + a history ping).
    const latN = Number(lat);
    const lngN = Number(lng);
    if (Number.isFinite(latN) && Number.isFinite(lngN) && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180) {
      const at = loc_at ? new Date(Number(loc_at)) : new Date();
      device.agent.location = { lat: latN, lng: lngN, accuracy: Number(accuracy) || null, at };
      LocationPing.create({
        device_id: device._id,
        customer_id: device.assigned_to || null,
        lat: latN, lng: lngN, accuracy: Number(accuracy) || null, at,
      }).catch(() => {});
    }
    await reconcileWithSale(device);
    await device.save();
    // First time this phone reports its IMEI: fold any duplicate records into one.
    let current = device;
    if (newImei) {
      const kept = await mergeDevicesByImei(newImei);
      if (kept && String(kept._id) !== String(device._id)) current = kept;
    }
    const info = await lockInfoFor(current);
    return res.status(200).json({ success: true, ...info });
  } catch (error) {
    logger.error('[agent] heartbeat error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/** GET /api/agent/commands — lightweight poll, same auth as heartbeat. */
const commands = async (req, res) => {
  try {
    const device = await authDevice(req, res);
    if (!device) return;
    await noteBackOnline(device);
    device.agent.last_heartbeat = new Date();
    await reconcileWithSale(device);
    await device.save();
    const info = await lockInfoFor(device);
    return res.status(200).json({ success: true, ...info });
  } catch (error) {
    logger.error('[agent] commands error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/agent/ack — the agent confirms it applied a state.
 * Body: { applied_state: 'locked' | 'unlocked' }
 */
const ack = async (req, res) => {
  try {
    const device = await authDevice(req, res);
    if (!device) return;
    const { applied_state } = req.body || {};
    if (applied_state === 'locked' || applied_state === 'unlocked') {
      device.lock_status = applied_state;
      device.agent.applied_state = applied_state;
      device.agent.last_heartbeat = new Date();
      await device.save();
    } else if (applied_state === 'released') {
      // The phone relinquished Device Owner — it's the customer's now.
      device.lock_status = 'unlocked';
      device.agent.applied_state = 'released';
      device.agent.enrolled = false;
      device.agent.enrollment_status = 'released';
      device.agent.last_heartbeat = new Date();
      await device.save();
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('[agent] ack error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/agent/event — the phone reports something worth knowing:
 * { type: 'shutdown' | 'admin_disable_attempt', detail, at }.
 * Tamper events are texted to the company numbers.
 */
const deviceEvent = async (req, res) => {
  try {
    const device = await authDevice(req, res);
    if (!device) return;
    const { type, detail, at } = req.body || {};
    const texted = await handleDeviceEvent(device, type, detail, at);
    await device.save();
    logger.info('[agent] event %s from %s%s', type, device.model || device._id, texted ? ' (company texted)' : '');
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('[agent] event error: %s', error.message);
    return res.status(500).json({ success: false });
  }
};

/**
 * POST /api/agent/trace — enrollment breadcrumb from a phone during QR setup
 * (before it has a device secret). Only accepted with a valid enrollment token.
 */
const trace = async (req, res) => {
  try {
    const b = req.body || {};
    const token = String(b.enrollment_token || '');
    const settings = await Settings.getSingleton();
    // A phone reports its very first step before it has the QR's token, so a
    // missing token is accepted (rate-limited, auto-deleted); a wrong one isn't.
    const valid = !token || token === settings.stock_enrollment_token ||
      await Device.exists({ 'agent.enrollment_token': token });
    if (!valid) return res.status(403).json({ success: false });
    const AgentTrace = require('../models/AgentTrace');
    await AgentTrace.create({
      stage: String(b.stage || '').slice(0, 60),
      detail: (String(b.detail || '') + (token ? '' : ' (no token yet)')).slice(0, 300),
      model: String(b.model || '').slice(0, 80),
      android_version: String(b.android_version || '').slice(0, 20),
      app_version: String(b.app_version || '').slice(0, 20),
      device_ref: String(b.device_id || '').slice(-6),
    });
    logger.info('[agent] trace %s %s: %s', b.model, b.stage, b.detail || '');
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('[agent] trace error: %s', error.message);
    return res.status(500).json({ success: false });
  }
};

module.exports = { enroll, heartbeat, commands, ack, trace, deviceEvent };
