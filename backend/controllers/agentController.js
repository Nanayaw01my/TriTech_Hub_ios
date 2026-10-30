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

const POLL_INTERVAL_SECONDS = Number(process.env.AGENT_POLL_SECONDS || 900);

function safeEqual(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
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
    if (fcm_token) device.agent.fcm_token = fcm_token;
    if (android_version) device.agent.android_version = android_version;
    if (app_version) device.agent.app_version = app_version;
    if (model) device.agent.model_reported = model;
    if (imei && !device.imei) device.imei = imei;
    device.agent.last_heartbeat = new Date();

    // Until the admin activates a sale for this phone it shows the "Awaiting
    // Activation" first page: stock phones (unassigned) and phones whose sale
    // is still pending. Activation (activatePlan) releases it.
    let awaiting = !device.assigned_to;
    if (!awaiting) {
      const plan = await InstallmentPlan.findOne({ device_id: device._id }).sort({ createdAt: -1 }).lean();
      awaiting = ['pending', 'returned', 'approved'].includes(plan?.status);
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
  if (!device || !safeEqual(device.agent?.device_secret, secret)) {
    res.status(401).json({ success: false, message: 'Invalid device credentials.' });
    return null;
  }
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
    device.agent.last_heartbeat = new Date();
    if (fcm_token && fcm_token !== device.agent.fcm_token) device.agent.fcm_token = fcm_token;
    if (android_version) device.agent.android_version = android_version;
    if (app_version) device.agent.app_version = app_version;
    // Trust the agent's report of what it actually applied.
    if (lock_state === 'locked' || lock_state === 'unlocked') device.lock_status = lock_state;

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
    device.agent.last_heartbeat = new Date();
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
      device.agent.last_heartbeat = new Date();
      await device.save();
    } else if (applied_state === 'released') {
      // The phone relinquished Device Owner — it's the customer's now.
      device.lock_status = 'unlocked';
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

module.exports = { enroll, heartbeat, commands, ack, trace };
