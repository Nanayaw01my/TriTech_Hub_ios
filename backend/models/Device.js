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

module.exports = mongoose.model('Device', DeviceSchema);
