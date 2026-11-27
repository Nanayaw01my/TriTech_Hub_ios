/**
 * Staff phones: company phones used by staff (not for sale). Enrolled with
 * their own QR / .bat, kept out of stock and sales, tracked, logo wallpaper,
 * SIM alerts, remote lock (shared /devices/:id/lock|unlock) and remote wipe.
 */
const crypto = require('crypto');
const Device = require('../models/Device');
const User = require('../models/User');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const agent = require('../utils/androidAgent');
const logger = require('../utils/logger');

const ONLINE_MS = 20 * 60 * 1000;

async function staffToken() {
  const settings = await Settings.getSingleton();
  if (!settings.staff_enrollment_token) {
    settings.staff_enrollment_token = 'sfp_' + crypto.randomBytes(18).toString('hex');
    await settings.save();
  }
  return settings.staff_enrollment_token;
}

/** "1.141" → 1141; unknown → 0. */
function appNumber(v) {
  const m = String(v || '').match(/^(\d+)\.(\d+)/);
  return m ? Number(m[1]) * 1000 + Number(m[2]) : 0;
}
const canWipe = (d) => appNumber(d.agent?.app_version) >= 1141;

function view(d) {
  const a = d.agent || {};
  return {
    _id: d._id,
    model: d.model,
    imei: d.imei || '',
    device_code: a.device_id ? String(a.device_id).slice(-6) : '',
    used_by: d.used_by ? { _id: d.used_by._id, name: d.used_by.name, staff_id: d.used_by.staff_id || '', phone: d.used_by.phone || '' } : null,
    used_since: d.used_since || null,
    note: d.staff_note || '',
    enrolled: !!a.enrolled,
    online: !!a.last_heartbeat && Date.now() - new Date(a.last_heartbeat).getTime() < ONLINE_MS,
    last_seen: a.last_heartbeat || null,
    lock_status: d.lock_status,
    desired: a.desired_lock_state || 'unlocked',
    applied_state: a.applied_state || null,
    app_version: a.app_version || null,
    can_wipe: canWipe(d),
    status: a.status?.at ? a.status : null,
    sim_changed_at: a.sim_changed_at || null,
    sim_history: (a.sim_history || []).slice(-5).reverse(),
    location: a.location?.lat != null ? a.location : null,
    wipe_requested_at: a.wipe_requested_at || null,
    wiped: a.applied_state === 'wiped',
    frp_status: a.frp_status || null,
    enrolled_at: d.createdAt,
  };
}

/** GET /api/admin/staff-phones — the staff QR + every staff phone. */
const listStaffPhones = async (req, res) => {
  try {
    const token = await staffToken();
    const baseUrl = process.env.PUBLIC_BACKEND_URL || `${req.protocol}://${req.get('host')}`;
    const payload = agent.buildProvisioningPayload(token, { baseUrl });
    let qr = null;
    try {
      const QRCode = require('qrcode');
      qr = await QRCode.toDataURL(JSON.stringify(payload), { errorCorrectionLevel: 'M', margin: 1, width: 360 });
    } catch (e) { logger.warn('[staff-phones] QR unavailable: %s', e.message); }
    const phones = await Device.find({ kind: 'staff', 'agent.enrollment_status': { $ne: 'released' } })
      .populate({ path: 'used_by', select: 'name staff_id phone' })
      .sort({ createdAt: -1 })
      .lean();
    const wiped = await Device.find({ kind: 'staff', 'agent.applied_state': 'wiped' })
      .populate({ path: 'used_by', select: 'name staff_id phone' })
      .sort({ updatedAt: -1 }).limit(20).lean();
    return res.status(200).json({
      success: true,
      data: {
        ready: agent.provisioningReady(),
        checksum: payload['android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM'],
        qr,
        phones: phones.map(view),
        wiped: wiped.map(view),
      },
    });
  } catch (error) {
    logger.error('listStaffPhones error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/** GET /api/admin/staff-phones/computer-script — enroll-staff-phone.bat */
const staffComputerScript = async (req, res) => {
  try {
    const token = await staffToken();
    const base = (process.env.PUBLIC_BACKEND_URL || agent.config.BACKEND_URL).replace(/\/+$/, '').replace(/^http:/i, 'https:');
    const { buildEnrollScript } = require('../utils/computerEnroll');
    const script = buildEnrollScript({ token, backend: base, apkUrl: `${base}/downloads/dandorsolar-lock-agent.apk` });
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="enroll-staff-phone.bat"');
    return res.status(200).send(script);
  } catch (error) {
    logger.error('staffComputerScript error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

async function findStaffPhone(id) {
  return Device.findOne({ _id: id, kind: 'staff' });
}

/** PUT /api/admin/staff-phones/:id { user_id | null, note } — who uses it. */
const updateStaffPhone = async (req, res) => {
  try {
    const d = await findStaffPhone(req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Staff phone not found.' });
    const b = req.body || {};
    if (b.user_id !== undefined) {
      if (b.user_id) {
        const u = await User.findOne({ _id: b.user_id, role: { $in: ['staff', 'admin', 'superadmin', 'collector'] } }).select('_id');
        if (!u) return res.status(400).json({ success: false, message: 'Choose a staff member.' });
        if (String(d.used_by) !== String(u._id)) { d.used_by = u._id; d.used_since = new Date(); }
      } else {
        d.used_by = null;
        d.used_since = null;
      }
    }
    if (b.note !== undefined) d.staff_note = String(b.note || '').trim().slice(0, 120) || null;
    await d.save();
    await AuditLog.create({
      user_id: req.user._id, action: 'staff_phone_updated', ip_address: req.ip,
      details: { device_id: d._id, model: d.model, imei: d.imei, used_by: d.used_by, note: d.staff_note },
    }).catch(() => {});
    return res.status(200).json({ success: true, message: 'Saved.' });
  } catch (error) {
    logger.error('updateStaffPhone error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/** POST /api/admin/staff-phones/:id/wipe { confirm: 'WIPE' } — erase the phone. */
const wipeStaffPhone = async (req, res) => {
  try {
    if (String(req.body?.confirm || '').trim().toUpperCase() !== 'WIPE') {
      return res.status(400).json({ success: false, message: 'Type WIPE to confirm.' });
    }
    const d = await findStaffPhone(req.params.id);
    if (!d || !d.agent?.enrolled) return res.status(404).json({ success: false, message: 'Staff phone not found or no longer managed.' });
    if (!canWipe(d)) {
      return res.status(400).json({ success: false, message: 'This phone has an older app that cannot wipe. Lock it instead; it updates itself to the new app when online.' });
    }
    d.agent.desired_lock_state = 'wipe';
    d.agent.wipe_requested_at = new Date();
    d.agent.wipe_requested_by = req.user._id;
    d.lock_status = 'locked';
    await d.save();
    let delivered = false;
    try { const r = await agent.pushCommand(d); delivered = !!r?.pushed; } catch { /* next check-in */ }
    await AuditLog.create({
      user_id: req.user._id, action: 'staff_phone_wipe', ip_address: req.ip,
      details: { device_id: d._id, model: d.model, imei: d.imei, used_by: d.used_by, requested: true, reason: String(req.body?.reason || '').slice(0, 200) },
    }).catch(() => {});
    return res.status(200).json({
      success: true,
      message: delivered
        ? 'Wipe sent. The phone erases everything as soon as it gets it.'
        : 'Wipe queued. The phone erases everything the next time it is online. You can still cancel until then.',
    });
  } catch (error) {
    logger.error('wipeStaffPhone error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/** POST /api/admin/staff-phones/:id/cancel-wipe — only before the phone got it. */
const cancelWipeStaffPhone = async (req, res) => {
  try {
    const d = await findStaffPhone(req.params.id);
    if (!d) return res.status(404).json({ success: false, message: 'Staff phone not found.' });
    if (d.agent?.desired_lock_state !== 'wipe') return res.status(400).json({ success: false, message: 'No wipe is waiting.' });
    if (d.agent?.applied_state === 'wiped') return res.status(400).json({ success: false, message: 'Too late: the phone has already been wiped.' });
    d.agent.desired_lock_state = 'locked';
    d.agent.wipe_requested_at = null;
    d.agent.wipe_requested_by = null;
    await d.save();
    try { await agent.pushCommand(d); } catch { /* next check-in */ }
    return res.status(200).json({ success: true, message: 'Wipe cancelled. The phone stays locked.' });
  } catch (error) {
    logger.error('cancelWipeStaffPhone error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { listStaffPhones, staffComputerScript, updateStaffPhone, wipeStaffPhone, cancelWipeStaffPhone, appNumber };
