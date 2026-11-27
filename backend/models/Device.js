const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema(
  {
    model: {
      type: String,
      required: [true, 'Device model is required'],
      trim: true,
    },
    color: {
      type: String,
      trim: true,
      default: null,
    },
    storage: {
      type: String,
      trim: true,
      default: null,
    },
    price: {
      type: Number,
      required: [true, 'Device price is required'],
      min: [0, 'Price cannot be negative'],
    },
    // Price set by the admin on this phone (Enroll Stock). When true, the
    // DSR's sale uses this price and can't change it.
    price_set_by_admin: {
      type: Boolean,
      default: false,
    },
    serial_number: {
      type: String,
      unique: true,
      trim: true,
      sparse: true,
    },
    udid: {
      type: String,
      unique: true,
      trim: true,
      sparse: true,
    },
    imei: {
      type: String,
      trim: true,
    },
    lock_status: {
      type: String,
      enum: ['locked', 'unlocked'],
      default: 'unlocked',
    },
    // ── Android lock agent (Device Owner app installed on the phone) ──
    // Replaces the old iOS SimpleMDM/Lost Mode mechanism.
    agent: {
      enrolled: { type: Boolean, default: false },
      // Stable id the on-phone agent reports for itself (Android ID based).
      device_id: { type: String, trim: true, default: null },
      // Secret issued once at enrollment; the agent sends it on every call.
      device_secret: { type: String, default: null },
      // One-time token embedded in the provisioning QR, consumed at enroll.
      enrollment_token: { type: String, trim: true, default: null },
      enrollment_status: {
        type: String,
        enum: ['none', 'pending', 'enrolled', 'revoked', 'released'],
        default: 'none',
      },
      // Firebase Cloud Messaging token for instant lock/unlock push.
      fcm_token: { type: String, default: null },
      // What the backend WANTS the phone to be; the agent converges to this.
      // 'pending_activation' = in stock / sale not yet activated by the admin:
      // the phone shows the "Awaiting Activation" first page until activated.
      desired_lock_state: { type: String, enum: ['locked', 'unlocked', 'released', 'pending_activation', 'wipe'], default: 'unlocked' },
      // Offline failsafe: the phone stores this deadline locally and locks ITSELF
      // (no internet needed) once the clock passes it. The backend keeps it in
      // the future while the customer is paid up, and moves it forward on every
      // payment. null = no deadline (stock/unactivated/released).
      paid_until: { type: Date, default: null },
      last_heartbeat: { type: Date, default: null },
      // What the phone itself says it is showing (from its last check-in):
      // 'pending' = Awaiting Activation page, 'locked', 'unlocked', 'released'.
      applied_state: { type: String, default: null },
      // The phone's check-ins are being refused (its key doesn't match ours).
      rejected_at: { type: Date, default: null },
      // Admin pressed "Reconnect phone": until this time, the phone's next
      // check-in is accepted with the key it has, which becomes the saved key.
      rekey_until: { type: Date, default: null },
      app_version: { type: String, default: null },
      android_version: { type: String, default: null },
      model_reported: { type: String, default: null },
      // Build number of the app on the phone (self-update compares against it).
      version_code: { type: Number, default: null },
      update_error: { type: String, default: null },
      // Factory Reset Protection as reported by the phone: on / on_legacy /
      // off / failed / unsupported. null = old app that doesn't support FRP.
      frp_status: { type: String, default: null },
      // Tamper watch: when the phone last reported being switched off, when we
      // texted the company that it went silent (cleared when it checks in
      // again), and the last tamper event the phone reported.
      last_shutdown_at: { type: Date, default: null },
      silent_alert_at: { type: Date, default: null },
      last_tamper: {
        type: { type: String, default: null },
        at: { type: Date, default: null },
        detail: { type: String, default: null },
      },
      // Phone status from its last check-in (app 1.141+): battery, network, SIMs.
      status: {
        battery: { type: Number, default: null },
        charging: { type: Boolean, default: null },
        network: { type: String, default: null },
        sims: [{ _id: false, slot: Number, carrier: String, number: String, iccid_tail: String }],
        at: { type: Date, default: null },
      },
      // Fingerprint of the SIM card(s) in the phone ('' = no SIM). A change on a
      // staff phone texts the company.
      sim_key: { type: String, default: null },
      sim_changed_at: { type: Date, default: null },
      sim_alert_at: { type: Date, default: null },
      sim_history: [{ _id: false, at: Date, sims: String }],
      // Remote wipe requested by an admin (staff phones) and when the phone confirmed.
      wipe_requested_at: { type: Date, default: null },
      wipe_requested_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      // Last-known GPS location reported by the phone.
      location: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        accuracy: { type: Number, default: null },
        at: { type: Date, default: null },
      },
    },
    // What the company paid for this phone (for profit reports). null = not entered.
    cost_price: { type: Number, default: null, min: 0 },
    sold_status: {
      type: String,
      enum: ['available', 'sold'],
      default: 'available',
    },
    assigned_to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    // Stock handed to a DSR to sell. Only that DSR sees it in their phone
    // picker. null = with the admin/office.
    held_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    held_since: {
      type: Date,
      default: null,
    },
    // 'stock' = phones you sell (the default). 'staff' = company phones your
    // staff use: never in stock/sales, never payment-locked; tracked, logo
    // wallpaper, SIM alerts, remote lock/wipe. Set by the QR used to enrol it.
    kind: { type: String, enum: ['stock', 'staff'], default: 'stock' },
    // Staff phone: who uses it.
    used_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    used_since: { type: Date, default: null },
    staff_note: { type: String, trim: true, default: null, maxlength: 120 },
  },
  {
    timestamps: true,
  }
);

// Staff phones are kept out of everything about stock and sales: any query that
// doesn't name them (by kind, _id or the phone's own id/token) skips them.
// Ask for them with .setOptions({ includeStaff: true }) or { kind: 'staff' }.
const NAMES_A_PHONE = ['kind', '_id', 'agent.device_id', 'agent.enrollment_token'];
function hideStaffPhones() {
  if (this.getOptions?.().includeStaff) return;
  const f = this.getFilter ? this.getFilter() : {};
  if (f && NAMES_A_PHONE.some((k) => Object.prototype.hasOwnProperty.call(f, k))) return;
  this.where({ kind: { $ne: 'staff' } });
}
['find', 'findOne', 'countDocuments', 'distinct'].forEach((op) => DeviceSchema.pre(op, hideStaffPhones));
DeviceSchema.pre('aggregate', function hideStaffInAggregate() {
  if (this.options?.includeStaff) return;
  const first = this.pipeline()[0];
  if (first?.$match && Object.prototype.hasOwnProperty.call(first.$match, 'kind')) return;
  this.pipeline().unshift({ $match: { kind: { $ne: 'staff' } } });
});

DeviceSchema.index({ kind: 1 });
DeviceSchema.index({ assigned_to: 1 });
DeviceSchema.index({ lock_status: 1 });
DeviceSchema.index({ sold_status: 1 });
DeviceSchema.index({ lock_status: 1, sold_status: 1 });
DeviceSchema.index({ model: 'text' });
DeviceSchema.index({ 'agent.device_id': 1 }, { sparse: true });
DeviceSchema.index({ 'agent.enrollment_token': 1 }, { sparse: true });
DeviceSchema.index({ 'agent.enrolled': 1 });

module.exports = mongoose.model('Device', DeviceSchema);
