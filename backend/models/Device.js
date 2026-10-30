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
      desired_lock_state: { type: String, enum: ['locked', 'unlocked', 'released', 'pending_activation'], default: 'unlocked' },
      // Offline failsafe: the phone stores this deadline locally and locks ITSELF
      // (no internet needed) once the clock passes it. The backend keeps it in
      // the future while the customer is paid up, and moves it forward on every
      // payment. null = no deadline (stock/unactivated/released).
      paid_until: { type: Date, default: null },
      last_heartbeat: { type: Date, default: null },
      app_version: { type: String, default: null },
      android_version: { type: String, default: null },
      model_reported: { type: String, default: null },
      // Build number of the app on the phone (self-update compares against it).
      version_code: { type: Number, default: null },
      update_error: { type: String, default: null },
      // Factory Reset Protection as reported by the phone: on / on_legacy /
      // off / failed / unsupported. null = old app that doesn't support FRP.
      frp_status: { type: String, default: null },
      // Last-known GPS location reported by the phone.
      location: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        accuracy: { type: Number, default: null },
        at: { type: Date, default: null },
      },
    },
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
  },
  {
    timestamps: true,
  }
);

DeviceSchema.index({ assigned_to: 1 });
DeviceSchema.index({ lock_status: 1 });
DeviceSchema.index({ sold_status: 1 });
DeviceSchema.index({ lock_status: 1, sold_status: 1 });
DeviceSchema.index({ model: 'text' });
DeviceSchema.index({ 'agent.device_id': 1 }, { sparse: true });
DeviceSchema.index({ 'agent.enrollment_token': 1 }, { sparse: true });
DeviceSchema.index({ 'agent.enrolled': 1 });

module.exports = mongoose.model('Device', DeviceSchema);
