/**
 * Device-facing endpoints for the Android lock agent (Device Owner app).
 * These are NOT behind the normal JWT auth — the phone authenticates with a
 * one-time enrollment token (to enroll) and then a per-device secret.
 */
const crypto = require('crypto');
const Device = require('../models/Device');
const Customer = require('../models/Customer');
const AuditLog = require('../models/AuditLog');
const LocationPing = require('../models/LocationPing');
const logger = require('../utils/logger');
const agent = require('../utils/androidAgent');

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
  return {
    desired_lock_state: device.agent?.desired_lock_state || 'unlocked',
    lock_message: agent.lockMessage(),
    business_name: agent.config.BUSINESS_NAME,
    unlock_contact: contact,
    poll_interval: POLL_INTERVAL_SECONDS,
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

    const device = await Device.findOne({ 'agent.enrollment_token': enrollment_token });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Invalid or expired enrollment token.' });
    }
    if (device.agent?.enrollment_status === 'revoked') {
      return res.status(403).json({ success: false, message: 'This enrollment has been revoked.' });
    }

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
    await device.save();

    await AuditLog.create({
      action: 'agent_enroll',
      details: { device_id: device._id, agent_device_id: device_id, model: device.model, imei },
      ip_address: req.ip,
    }).catch(() => {});

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
    const { fcm_token, lock_state, android_version, app_version, lat, lng, accuracy, loc_at } = req.body || {};
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
    const info = await lockInfoFor(device);
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
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    logger.error('[agent] ack error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { enroll, heartbeat, commands, ack };
