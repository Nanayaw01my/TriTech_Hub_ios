/**
 * Android lock agent engine.
 *
 * Replaces the old iOS SimpleMDM/Lost Mode integration. Each sold Android
 * phone runs the Dan Dorsolar lock agent as a **Device Owner** app. The
 * backend never talks to a third-party MDM — it stores the *desired* lock
 * state on the Device document and the agent converges to it:
 *
 *   - Instantly, when a Firebase Cloud Messaging (FCM) push can be delivered.
 *   - Otherwise on the agent's next heartbeat/poll (default every ~15 min).
 *
 * FCM is optional: if no Firebase credentials are configured the engine still
 * works (poll-only). This keeps the whole thing runnable before Firebase is
 * set up.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// ── Config (deploy-time) ──────────────────────────────────────────────────
const AGENT_PACKAGE = process.env.AGENT_PACKAGE || 'com.dandorsolar.lockagent';
const AGENT_RECEIVER =
  process.env.AGENT_RECEIVER || `${AGENT_PACKAGE}/.DeviceAdminReceiver`;
const BACKEND_URL =
  process.env.PUBLIC_BACKEND_URL || process.env.APP_BASE_URL || 'https://tritechhub.online';
// The signed agent APK is served from this app's own /downloads folder by
// default, so no external host is needed. Override AGENT_APK_URL to point
// elsewhere (e.g. a GitHub Release).
const APK_FILENAME = process.env.AGENT_APK_FILENAME || 'dandorsolar-lock-agent.apk';
const AGENT_APK_URL = process.env.AGENT_APK_URL || `${BACKEND_URL}/downloads/${APK_FILENAME}`;
// base64url SHA-256 of the APK's signing certificate. Read from env, else from
// the committed downloads/agent-checksum.txt that the build writes next to the
// APK. Until a checksum is available the provisioning QR is not "ready".
let _checksumCache;
function agentApkChecksum() {
  if (process.env.AGENT_APK_CHECKSUM) return process.env.AGENT_APK_CHECKSUM.trim();
  if (_checksumCache !== undefined) return _checksumCache;
  try {
    const p = path.join(__dirname, '..', 'downloads', 'agent-checksum.txt');
    _checksumCache = fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : '';
  } catch {
    _checksumCache = '';
  }
  return _checksumCache;
}
const BUSINESS_NAME = process.env.BUSINESS_NAME || 'Dan Dorsolar Company Limited';
const BUSINESS_PHONE = process.env.BUSINESS_PHONE || '';
// A phone is "online" if it has checked in within this window.
const ONLINE_WINDOW_MS = 20 * 60 * 1000;

// ── Firebase (lazy, optional) ──────────────────────────────────────────────
let _fcm = null;
let _fcmTried = false;
function getFcm() {
  if (_fcmTried) return _fcm;
  _fcmTried = true;
  try {
    const admin = require('firebase-admin');
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
    } else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      credential = admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    } else {
      logger.info('[agent] Firebase not configured — lock commands will apply on next poll (no instant push).');
      return null;
    }
    if (!admin.apps.length) admin.initializeApp({ credential });
    _fcm = admin.messaging();
    logger.info('[agent] Firebase Cloud Messaging ready.');
  } catch (err) {
    logger.warn('[agent] Firebase init failed (%s) — falling back to poll-only.', err.message);
    _fcm = null;
  }
  return _fcm;
}

// ── Tokens ─────────────────────────────────────────────────────────────────
const generateEnrollmentToken = () => 'enr_' + crypto.randomBytes(18).toString('hex');
const generateDeviceSecret = () => crypto.randomBytes(32).toString('hex');

// ── Messaging ────────────────────────────────────────────────────────────
/** The text shown on the phone's full-screen lock. */
function lockMessage(extra = '') {
  const call = BUSINESS_PHONE ? ` Call ${BUSINESS_PHONE} or ` : ' ';
  return (
    `This device is locked by ${BUSINESS_NAME} due to an overdue installment payment.` +
    `${call}make your payment to unlock it automatically.${extra ? ' ' + extra : ''}`
  );
}

function isOnline(device) {
  const hb = device?.agent?.last_heartbeat;
  return !!hb && Date.now() - new Date(hb).getTime() < ONLINE_WINDOW_MS;
}

/** Push a "sync now" data message to one device. Returns { pushed, reason }. */
async function pushCommand(device) {
  const token = device?.agent?.fcm_token;
  if (!token) return { pushed: false, reason: 'no_fcm_token' };
  const fcm = getFcm();
  if (!fcm) return { pushed: false, reason: 'fcm_not_configured' };
  try {
    await fcm.send({
      token,
      data: {
        command: 'sync',
        desired_lock_state: device.agent.desired_lock_state || 'unlocked',
        ts: String(Date.now()),
      },
      android: { priority: 'high', ttl: 60 * 60 * 1000 },
    });
    return { pushed: true };
  } catch (err) {
    logger.warn('[agent] FCM push failed for device %s: %s', device._id, err.message);
    return { pushed: false, reason: err.code || err.message };
  }
}

// ── Lock / unlock (drop-in for the old SimpleMDM calls) ─────────────────────
/**
 * Queue a lock for a device and try to deliver it instantly.
 * Accepts the Device mongoose document. Returns a plain result object; it does
 * not throw for an offline phone (the command simply waits for the next poll).
 */
async function lockDevice(device, opts = {}) {
  if (!device.agent) device.agent = {};
  device.agent.desired_lock_state = 'locked';
  await device.save();
  const { pushed, reason } = await pushCommand(device);
  const online = isOnline(device);
  return {
    ok: true,
    enrolled: !!device.agent.enrolled,
    pushed,
    reason,
    online,
    delivered: pushed || online,
    message: lockMessage(opts.extra),
  };
}

async function unlockDevice(device) {
  if (!device.agent) device.agent = {};
  device.agent.desired_lock_state = 'unlocked';
  await device.save();
  const { pushed, reason } = await pushCommand(device);
  const online = isOnline(device);
  return {
    ok: true,
    enrolled: !!device.agent.enrolled,
    pushed,
    reason,
    online,
    delivered: pushed || online,
  };
}

// ── Provisioning QR payload ────────────────────────────────────────────────
/**
 * Build the Android Device Owner provisioning JSON that a factory-reset phone
 * scans (tap the welcome screen 6 times → camera opens). Installs the agent
 * APK and makes it Device Owner, passing the enrollment token + backend URL
 * through to the app.
 */
function buildProvisioningPayload(enrollmentToken, opts = {}) {
  return {
    'android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME': AGENT_RECEIVER,
    'android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION': AGENT_APK_URL,
    'android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM': agentApkChecksum(),
    'android.app.extra.PROVISIONING_SKIP_ENCRYPTION': true,
    'android.app.extra.PROVISIONING_LEAVE_ALL_SYSTEM_APPS_ENABLED': true,
    'android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE': {
      enrollment_token: enrollmentToken,
      backend_url: BACKEND_URL,
      business_name: BUSINESS_NAME,
      unlock_contact: BUSINESS_PHONE,
      ...(opts.wifiSsid && { wifi_ssid: opts.wifiSsid }),
    },
    ...(opts.wifiSsid && {
      'android.app.extra.PROVISIONING_WIFI_SSID': opts.wifiSsid,
      ...(opts.wifiPassword && { 'android.app.extra.PROVISIONING_WIFI_PASSWORD': opts.wifiPassword }),
    }),
  };
}

function provisioningReady() {
  return !!(AGENT_APK_URL && agentApkChecksum());
}

module.exports = {
  lockDevice,
  unlockDevice,
  pushCommand,
  isOnline,
  lockMessage,
  generateEnrollmentToken,
  generateDeviceSecret,
  buildProvisioningPayload,
  provisioningReady,
  ONLINE_WINDOW_MS,
  config: { AGENT_PACKAGE, AGENT_RECEIVER, AGENT_APK_URL, BACKEND_URL, BUSINESS_NAME, BUSINESS_PHONE },
};
