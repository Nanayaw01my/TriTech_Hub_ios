const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Device = require('../models/Device');
const InstallmentPlan = require('../models/InstallmentPlan');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const Settings = require('../models/Settings');
const CommissionPayout = require('../models/CommissionPayout');
const { createTransferRecipient, initiateTransfer } = require('../utils/paystack');
const { generateStaffId } = require('../utils/accountGenerator');
const { sendPaymentReminderSMS, sendDeviceLockedSMS, sendDeviceUnlockedSMS, sendDeviceLockedWhatsApp, sendDeviceUnlockedWhatsApp } = require('../utils/sms');
const { sendLockNotificationEmail, sendDeviceUnlockedEmail } = require('../utils/email');
const { lockDevice: mdmLock, unlockDevice: mdmUnlock } = require('../utils/simpleMDM');
const logger = require('../utils/logger');

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

/**
 * GET /api/admin/dashboard
 * Returns aggregate stats: counts, revenue, recent transactions.
 */
const getDashboard = async (req, res) => {
  try {
    const [
      totalStaff,
      totalCustomers,
      totalDevices,
      overduePayments,
      lockedPhones,
      activeInstallmentPlans,
      recentTransactions,
      totalRevenue,
      monthlyRevenue,
    ] = await Promise.all([
      User.countDocuments({ role: 'staff', is_active: true }),
      Customer.countDocuments(),
      Device.countDocuments(),
      InstallmentPlan.countDocuments({ status: 'defaulted' }),
      Device.countDocuments({ lock_status: 'locked' }),
      InstallmentPlan.countDocuments({ status: 'active' }),
      Payment.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate({ path: 'customer_id', select: 'full_name email' })
        .populate({ path: 'installment_plan_id', select: 'device_id' })
        .lean(),
      Payment.aggregate([
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const totalRevenueAmount = totalRevenue[0]?.total || 0;
    const monthlyRevenueAmount = monthlyRevenue[0]?.total || 0;

    return res.status(200).json({
      success: true,
      message: 'Dashboard data retrieved.',
      data: {
        stats: {
          totalStaff,
          totalCustomers,
          totalDevices,
          overduePayments,
          lockedPhones,
          activeInstallmentPlans,
          totalRevenue: totalRevenueAmount,
          monthlyRevenue: monthlyRevenueAmount,
        },
        recentTransactions,
      },
    });
  } catch (error) {
    logger.error('Admin getDashboard error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/customers
 * Paginated list with search and filter.
 */
const getCustomers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const { search, region } = req.query;

    const filter = {};

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      // Find user IDs matching email or account_number
      const matchingUsers = await User.find({
        $or: [
          { email: searchRegex },
          { account_number: searchRegex },
          { phone: searchRegex },
        ],
      }).select('_id');

      const userIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { full_name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { ghana_card_id: searchRegex },
        { user_id: { $in: userIds } },
      ];
    }

    if (region) {
      filter['location.region'] = new RegExp(region, 'i');
    }

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .populate({ path: 'user_id', select: 'account_number email is_active' })
        .populate({ path: 'created_by', select: 'name email staff_id' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(filter),
    ]);

    // Attach installment plan data (device, status, next due) to each customer
    const customerIds = customers.map(c => c._id);
    const plans = await InstallmentPlan.find({ customer_id: { $in: customerIds } })
      .populate({ path: 'device_id', select: 'model lock_status' })
      .lean();

    const planByCustomer = {};
    plans.forEach(p => {
      const cid = p.customer_id?.toString();
      if (cid && (!planByCustomer[cid] || p.status === 'active')) {
        planByCustomer[cid] = p;
      }
    });

    const enriched = customers.map(c => {
      const plan = planByCustomer[c._id?.toString()];
      return {
        ...c,
        device_model: plan?.device_id?.model || null,
        plan_status: plan?.status || null,
        next_due_date: plan?.next_due_date || null,
        lock_status: plan?.device_id?.lock_status || null,
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Customers retrieved.',
      data: {
        customers: enriched,
        total,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Admin getCustomers error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/admin/customers/:id
 * Full customer detail with plan, payments, device.
 */
const getCustomerDetail = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate({ path: 'user_id', select: '-password' })
      .populate({ path: 'created_by', select: 'name email staff_id' })
      .lean();

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const [plan, payments] = await Promise.all([
      InstallmentPlan.findOne({ customer_id: customer._id })
        .populate({ path: 'device_id', select: 'model price serial_number udid imei lock_status' })
        .lean(),
      Payment.find({ customer_id: customer._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Customer detail retrieved.',
      data: { customer, plan, payments },
    });
  } catch (error) {
    logger.error('Admin getCustomerDetail error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/admin/customers/:id
 */
const updateCustomer = async (req, res) => {
  try {
    const allowedFields = [
      'full_name', 'phone', 'ghana_card_id', 'occupation',
      'income', 'location', 'guarantor', 'photos',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate({ path: 'user_id', select: '-password' });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    await AuditLog.create({
      user_id: req.user._id,
      action: 'customer_updated',
      target_user_id: customer.user_id,
      details: { customer_id: customer._id, updated_fields: Object.keys(updates) },
      ip_address: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Customer updated successfully.',
      data: { customer },
    });
  } catch (error) {
    logger.error('Admin updateCustomer error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * DELETE /api/admin/customers/:id
 */
const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const userId = customer.user_id;

    // Soft-delete: deactivate the user account
    await User.findByIdAndUpdate(userId, { is_active: false });

    await AuditLog.create({
      user_id: req.user._id,
      action: 'customer_deleted',
      target_user_id: userId,
      details: { customer_id: customer._id, customer_name: customer.full_name },
      ip_address: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Customer account deactivated successfully.',
      data: null,
    });
  } catch (error) {
    logger.error('Admin deleteCustomer error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── STAFF ────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/staff
 */
const getStaff = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = { role: 'staff', is_active: true };
    if (req.query.search) {
      const r = new RegExp(req.query.search, 'i');
      filter.$or = [{ name: r }, { email: r }, { staff_id: r }];
    }
    if (req.query.is_active !== undefined) {
      filter.is_active = req.query.is_active === 'true';
    }

    const [staff, total] = await Promise.all([
      User.find(filter).select('-password').sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    // Enrich with customer count
    const enriched = await Promise.all(
      staff.map(async (s) => {
        const customerCount = await Customer.countDocuments({ created_by: s._id });
        return { ...s, customer_count: customerCount };
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Staff list retrieved.',
      data: {
        staff: enriched,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    logger.error('Admin getStaff error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/admin/staff
 * Create a new staff member.
 */
const addStaff = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { name, email, password, phone, branch } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email is already in use.' });
    }

    const staffId = await generateStaffId();

    const newStaff = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phone: phone?.trim(),
      branch: branch?.trim() || null,
      role: 'staff',
      staff_id: staffId,
    });

    await AuditLog.create({
      user_id: req.user._id,
      action: 'staff_added',
      target_user_id: newStaff._id,
      details: { staff_id: staffId, name: newStaff.name, email: newStaff.email },
      ip_address: req.ip,
    });

    const staffData = await User.findById(newStaff._id).select('-password');

    return res.status(201).json({
      success: true,
      message: 'Staff member created successfully.',
      data: { staff: staffData },
    });
  } catch (error) {
    logger.error('Admin addStaff error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/admin/staff/:id
 */
const updateStaff = async (req, res) => {
  try {
    const allowedFields = ['name', 'phone', 'is_active'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    // Don't allow changing role or email via this endpoint
    const staffMember = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'staff' },
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!staffMember) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    await AuditLog.create({
      user_id: req.user._id,
      action: 'staff_updated',
      target_user_id: staffMember._id,
      details: { updated_fields: Object.keys(updates) },
      ip_address: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Staff member updated.',
      data: { staff: staffMember },
    });
  } catch (error) {
    logger.error('Admin updateStaff error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * DELETE /api/admin/staff/:id
 * Soft delete - set is_active=false.
 */
const deleteStaff = async (req, res) => {
  try {
    const staffMember = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'staff' },
      { is_active: false },
      { new: true }
    ).select('-password');

    if (!staffMember) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    await AuditLog.create({
      user_id: req.user._id,
      action: 'staff_deleted',
      target_user_id: staffMember._id,
      details: { name: staffMember.name, email: staffMember.email },
      ip_address: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Staff member deactivated successfully.',
      data: null,
    });
  } catch (error) {
    logger.error('Admin deleteStaff error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── DEVICES ──────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/devices
 */
const getDevices = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    // Catalog = devices not assigned to any customer
    const filter = { assigned_to: null };
    if (req.query.lock_status) filter.lock_status = req.query.lock_status;
    if (req.query.search) {
      const r = new RegExp(req.query.search, 'i');
      filter.$or = [{ model: r }, { serial_number: r }, { udid: r }, { imei: r }];
    }

    const [devices, total] = await Promise.all([
      Device.find(filter)
        .populate({
          path: 'assigned_to',
          select: 'full_name phone email',
          populate: { path: 'user_id', select: 'account_number' },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Device.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Devices retrieved.',
      data: {
        devices,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    logger.error('Admin getDevices error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/admin/device-sales
 * Returns all installment plans with customer + device info for the Sales tab.
 */
const getDeviceSales = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 25);
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status;
    const search = req.query.search;

    const filter = {};
    if (statusFilter) filter.status = statusFilter;

    let plans = await InstallmentPlan.find(filter)
      .populate({ path: 'customer_id', select: 'full_name phone email photos' })
      .populate({ path: 'device_id', select: 'model color storage price serial_number udid lock_status' })
      .populate({ path: 'created_by', select: 'name full_name staff_id' })
      .sort({ createdAt: -1 })
      .lean();

    // Apply search filter after populate (customer name / phone / device model)
    if (search) {
      const re = new RegExp(search, 'i');
      plans = plans.filter(p =>
        re.test(p.customer_id?.full_name) ||
        re.test(p.customer_id?.phone) ||
        re.test(p.device_id?.model)
      );
    }

    const total = plans.length;
    const paginated = plans.slice(skip, skip + limit);

    const sales = paginated.map(p => {
      const amountPaid = (p.down_payment || 0) + ((p.payments_made || 0) * (p.installment_amount || 0));
      return {
        _id: p._id,
        customer_id: p.customer_id?._id,
        customer_name: p.customer_id?.full_name || 'Unknown',
        customer_phone: p.customer_id?.phone || '',
        customer_photo: p.customer_id?.photos?.customer_photo || null,
        device_id: p.device_id?._id,
        lock_status: p.device_id?.lock_status || 'unlocked',
        has_udid: !!p.device_id?.udid,
        device_model: p.device_id?.model || 'Unknown',
        device_color: p.device_id?.color || '',
        device_storage: p.device_id?.storage || '',
        device_serial: p.device_id?.serial_number || '',
        total_price: p.total_price || 0,
        down_payment: p.down_payment || 0,
        installment_amount: p.installment_amount || 0,
        payments_made: p.payments_made || 0,
        total_payments: p.total_payments || 0,
        amount_paid: amountPaid,
        remaining_balance: p.remaining_balance || 0,
        frequency: p.frequency,
        status: p.status,
        next_due_date: p.next_due_date,
        start_date: p.start_date || p.createdAt,
        staff_name: p.created_by?.full_name || p.created_by?.name || 'Staff',
        staff_id: p.created_by?.staff_id || '',
      };
    });

    return res.status(200).json({
      success: true,
      data: { sales, total, page, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('getDeviceSales error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/admin/devices
 */
const addDevice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { model, color, storage, price, serial_number, udid, imei } = req.body;

    const device = await Device.create({ model, color, storage, price, serial_number, udid, imei });

    await AuditLog.create({
      user_id: req.user._id,
      action: 'device_added',
      device_udid: udid,
      details: { model, price, serial_number, device_id: device._id },
      ip_address: req.ip,
    });

    return res.status(201).json({
      success: true,
      message: 'Device added successfully.',
      data: { device },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A device with that serial number or UDID already exists.' });
    }
    logger.error('Admin addDevice error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/admin/devices/:id
 */
const updateDevice = async (req, res) => {
  try {
    const allowedFields = ['model', 'color', 'storage', 'price', 'serial_number', 'udid', 'imei'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const device = await Device.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    await AuditLog.create({
      user_id: req.user._id,
      action: 'device_updated',
      device_udid: device.udid,
      details: { device_id: device._id, updated_fields: Object.keys(updates) },
      ip_address: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Device updated.',
      data: { device },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A device with that serial number or UDID already exists.' });
    }
    logger.error('Admin updateDevice error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * DELETE /api/admin/devices/:id
 */
const deleteDevice = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found.' });
    }

    if (device.sold_status === 'sold') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a device that is currently sold/assigned to a customer.',
      });
    }

    await Device.findByIdAndDelete(req.params.id);

    await AuditLog.create({
      user_id: req.user._id,
      action: 'device_deleted',
      device_udid: device.udid,
      details: { model: device.model, serial_number: device.serial_number },
      ip_address: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Device deleted successfully.',
      data: null,
    });
  } catch (error) {
    logger.error('Admin deleteDevice error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/admin/devices/:id/lock
 */
const lockDeviceHandler = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) return res.status(404).json({ success: false, message: 'Device not found.' });
    if (device.lock_status === 'locked') {
      return res.status(400).json({ success: false, message: 'Device is already marked as locked.' });
    }
    if (!device.udid) {
      return res.status(400).json({
        success: false,
        message: 'This device has no UDID saved, so it cannot be locked remotely. Add the UDID from SimpleMDM to the device record first.',
      });
    }

    // Actually send the lock command to the phone via SimpleMDM.
    let supervised = null;
    try {
      const r = await mdmLock(device.udid);
      supervised = r?.supervised;
      logger.info(`[MDM] Lock command sent for UDID ${device.udid} (supervised: ${supervised})`);
    } catch (mdmErr) {
      logger.error(`[MDM] Lock failed for UDID ${device.udid}:`, mdmErr.message);
      return res.status(502).json({
        success: false,
        message: `Could not lock the device: ${mdmErr.message}. Check the UDID matches SimpleMDM and that SIMPLEMDM_API_KEY is set on the server.`,
      });
    }

    device.lock_status = 'locked';
    await device.save();

    await AuditLog.create({
      user_id: req.user._id,
      action: 'device_lock',
      device_udid: device.udid,
      details: {
        device_id: device._id,
        model: device.model,
        reason: req.body.reason || 'Manual lock by admin',
        supervised,
      },
      ip_address: req.ip,
    });

    const note = supervised === false
      ? ' Note: this iPhone is not supervised, so this is a basic screen lock the customer can dismiss with their passcode. Supervise the device for a lock they cannot remove.'
      : '';
    return res.status(200).json({
      success: true,
      message: 'Lock command sent to the device.' + note,
      data: { device },
    });
  } catch (error) {
    logger.error('Admin lockDevice error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/admin/devices/:id/unlock
 */
const unlockDeviceHandler = async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);
    if (!device) return res.status(404).json({ success: false, message: 'Device not found.' });
    if (device.lock_status === 'unlocked') {
      return res.status(400).json({ success: false, message: 'Device is already marked as unlocked.' });
    }
    if (!device.udid) {
      return res.status(400).json({
        success: false,
        message: 'This device has no UDID saved, so it cannot be unlocked remotely. Add the UDID from SimpleMDM to the device record first.',
      });
    }

    // Actually send the unlock command to the phone via SimpleMDM.
    try {
      await mdmUnlock(device.udid);
      logger.info(`[MDM] Unlock command sent for UDID ${device.udid}`);
    } catch (mdmErr) {
      logger.error(`[MDM] Unlock failed for UDID ${device.udid}:`, mdmErr.message);
      return res.status(502).json({
        success: false,
        message: `Could not unlock the device: ${mdmErr.message}. Check the UDID matches SimpleMDM and that SIMPLEMDM_API_KEY is set on the server.`,
      });
    }

    device.lock_status = 'unlocked';
    await device.save();

    await AuditLog.create({
      user_id: req.user._id,
      action: 'device_unlock',
      device_udid: device.udid,
      details: {
        device_id: device._id,
        model: device.model,
        reason: req.body.reason || 'Manual unlock by admin',
      },
      ip_address: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Unlock command sent to the device.',
      data: { device },
    });
  } catch (error) {
    logger.error('Admin unlockDevice error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/transactions
 */
const getTransactions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.payment_method) filter.payment_method = req.query.payment_method;

    // Accept both from/to and from_date/to_date
    const fromDate = req.query.from || req.query.from_date;
    const toDate = req.query.to || req.query.to_date;
    if (fromDate || toDate) {
      filter.payment_date = {};
      if (fromDate) filter.payment_date.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.payment_date.$lte = end;
      }
    }

    const [payments, total, amountAgg] = await Promise.all([
      Payment.find(filter)
        .populate({ path: 'customer_id', select: 'full_name email phone' })
        .populate({ path: 'installment_plan_id', select: 'frequency' })
        .sort({ payment_date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments(filter),
      Payment.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    ]);

    const totalAmount = amountAgg[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const transactions = payments.map(p => ({
      _id: p._id,
      id: p._id,
      customer_name: p.customer_id?.full_name || 'Unknown',
      customer_email: p.customer_id?.email || '',
      customer_phone: p.customer_id?.phone || '',
      amount: p.amount,
      payment_method: p.payment_method,
      method: p.payment_method,
      reference: p.paystack_reference || p.reference || '',
      status: p.paystack_status === 'success' ? 'paid' : (p.paystack_status || 'paid'),
      payment_date: p.payment_date,
      created_at: p.payment_date || p.createdAt,
      notes: p.notes || '',
    }));

    return res.status(200).json({
      success: true,
      message: 'Transactions retrieved.',
      data: {
        transactions,
        total,
        totalPages,
        total_amount: totalAmount,
        pagination: { page, limit, total, pages: totalPages },
      },
    });
  } catch (error) {
    logger.error('Admin getTransactions error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── REPORTS ──────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/reports
 * Aggregate data for daily/weekly/monthly reports.
 */
const getReports = async (req, res) => {
  try {
    const { period = 'monthly', year, month } = req.query;
    const now = new Date();
    let startDate, endDate, groupBy;

    if (period === 'daily') {
      // Last 30 days
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      endDate = now;
      groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$payment_date' } };
    } else if (period === 'weekly') {
      // Last 12 weeks
      startDate = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
      endDate = now;
      groupBy = {
        $concat: [
          { $toString: { $isoWeekYear: '$payment_date' } },
          '-W',
          { $toString: { $isoWeek: '$payment_date' } },
        ],
      };
    } else {
      // Monthly: last 12 months
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      endDate = now;
      groupBy = { $dateToString: { format: '%Y-%m', date: '$payment_date' } };
    }

    const [revenueData, paymentMethodSplit, newCustomers, deviceStats] = await Promise.all([
      Payment.aggregate([
        { $match: { payment_date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: groupBy,
            total_revenue: { $sum: '$amount' },
            transaction_count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Payment.aggregate([
        { $match: { payment_date: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$payment_method',
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      Customer.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: { $dateToString: { format: period === 'daily' ? '%Y-%m-%d' : '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Device.aggregate([
        {
          $group: {
            _id: '$sold_status',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const totalRevenue = revenueData.reduce((sum, r) => sum + r.total_revenue, 0);
    const totalTransactions = revenueData.reduce((sum, r) => sum + r.transaction_count, 0);

    return res.status(200).json({
      success: true,
      message: 'Reports retrieved.',
      data: {
        period,
        summary: {
          totalRevenue,
          totalTransactions,
          avgTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
        },
        revenueData,
        paymentMethodSplit,
        newCustomers,
        deviceStats,
      },
    });
  } catch (error) {
    logger.error('Admin getReports error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

/**
 * GET /api/admin/audit-logs
 */
const getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.user_id) filter.user_id = req.query.user_id;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate({ path: 'user_id', select: 'name email role' })
        .populate({ path: 'target_user_id', select: 'name email role account_number staff_id' })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Audit logs retrieved.',
      data: {
        logs,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    logger.error('Admin getAuditLogs error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── RESET CUSTOMER PASSWORD ──────────────────────────────────────────────────

/**
 * POST /api/admin/reset-customer-password/:id
 * Admin resets a customer's password directly.
 */
const resetCustomerPassword = async (req, res) => {
  try {
    let { new_password } = req.body;

    // If the admin didn't specify one, generate a simple 5-digit PIN
    // (customers use short numeric passwords).
    if (!new_password) {
      new_password = String(Math.floor(10000 + Math.random() * 90000));
    }

    // Customers have max 5 char passwords
    if (new_password.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Customer password must be at most 5 characters.',
      });
    }

    // Find the customer to get their user_id
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const user = await User.findById(customer.user_id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Customer user account not found.' });
    }

    user.password = new_password;
    await user.save();

    // Send the new password to the customer by SMS (best-effort).
    let smsStatus = 'not sent';
    if (customer.phone) {
      try {
        const { sendSMS } = require('../utils/sms');
        await sendSMS(
          customer.phone,
          `Hi ${customer.full_name}, your TriTech Hub password has been reset. New password: ${new_password}. Login at tritechhub.online -Tritech Hub`
        );
        smsStatus = 'sent';
      } catch (smsErr) {
        smsStatus = 'failed';
        logger.error('Reset-password SMS failed: %s', smsErr.message);
      }
    }

    await AuditLog.create({
      user_id: req.user._id,
      action: 'password_reset',
      target_user_id: user._id,
      details: { event: 'admin_reset_customer_password', customer_id: customer._id, sms: smsStatus },
      ip_address: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Customer password reset successfully.',
      // Return the new password so the admin can relay it to the customer.
      data: { new_password, sms: smsStatus },
    });
  } catch (error) {
    logger.error('Admin resetCustomerPassword error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

const SETTINGS_ALLOWED_KEYS = [
  'business_name', 'contact_email', 'contact_phone', 'contact_address',
  'whatsapp_number', 'lock_grace_period_hours', 'installment_frequencies', 'currency',
];

const getSettings = async (req, res) => {
  try {
    const settings = await Settings.getSingleton();
    return res.status(200).json({
      success: true,
      message: 'Settings retrieved.',
      data: { settings },
    });
  } catch (error) {
    logger.error('Admin getSettings error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateSettings = async (req, res) => {
  try {
    const updates = {};
    for (const key of SETTINGS_ALLOWED_KEYS) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: updates },
      { upsert: true, new: true, runValidators: true }
    );

    logger.info('Settings updated by admin %s', req.user?.id);
    return res.status(200).json({
      success: true,
      message: 'Settings updated.',
      data: { settings },
    });
  } catch (error) {
    logger.error('Admin updateSettings error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getStaffSales = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();
    let periodStart;
    if (period === 'week') {
      periodStart = new Date(now);
      periodStart.setDate(now.getDate() - now.getDay());
      periodStart.setHours(0, 0, 0, 0);
    } else if (period === 'all') {
      periodStart = new Date(0);
    } else {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const staffUsers = await User.find({ role: 'staff', is_active: true })
      .select('name email staff_id phone branch commission_per_sale')
      .sort({ created_at: -1 });

    const salesData = await Promise.all(
      staffUsers.map(async (s) => {
        const [totalSales, periodSales] = await Promise.all([
          Customer.countDocuments({ created_by: s._id }),
          Customer.countDocuments({ created_by: s._id, createdAt: { $gte: periodStart } }),
        ]);
        const rate = s.commission_per_sale || 100;
        return {
          _id: s._id,
          name: s.name,
          email: s.email,
          staff_id: s.staff_id,
          phone: s.phone,
          branch: s.branch || null,
          commission_per_sale: rate,
          total_sales: totalSales,
          period_sales: periodSales,
          commission_owed: periodSales * rate,
        };
      })
    );

    return res.status(200).json({ success: true, data: { salesData, period } });
  } catch (error) {
    logger.error('Admin getStaffSales error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const updateStaffCommissionRate = async (req, res) => {
  try {
    const { id } = req.params;
    const rate = Number(req.body.commission_per_sale);
    if (isNaN(rate) || rate < 0) {
      return res.status(400).json({ success: false, message: 'Valid commission rate required.' });
    }
    const user = await User.findOneAndUpdate(
      { _id: id, role: 'staff' },
      { commission_per_sale: rate },
      { new: true }
    ).select('name email staff_id commission_per_sale');
    if (!user) return res.status(404).json({ success: false, message: 'Staff not found.' });
    return res.status(200).json({ success: true, data: { user }, message: 'Commission rate updated.' });
  } catch (error) {
    logger.error('Admin updateStaffCommissionRate error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── CLEAR ALL DATA ──────────────────────────────────────────────────────────

const clearAllData = async (req, res) => {
  try {
    const PasswordReset = require('../models/PasswordReset');

    const [customers, devices, plans, payments, logs, resets] = await Promise.all([
      Customer.deleteMany({}),
      Device.deleteMany({}),
      InstallmentPlan.deleteMany({}),
      Payment.deleteMany({}),
      AuditLog.deleteMany({}),
      PasswordReset.deleteMany({}),
    ]);

    // Delete customer user accounts (role: 'customer') but keep admin and staff
    await User.deleteMany({ role: 'customer' });

    return res.status(200).json({
      success: true,
      message: 'All data cleared successfully. Admin and staff accounts preserved.',
      data: {
        deleted: {
          customers: customers.deletedCount,
          devices: devices.deletedCount,
          installmentPlans: plans.deletedCount,
          payments: payments.deletedCount,
          auditLogs: logs.deletedCount,
          passwordResets: resets.deletedCount,
        },
      },
    });
  } catch (error) {
    logger.error('Admin clearAllData error:', error);
    return res.status(500).json({ success: false, message: 'Server error while clearing data.' });
  }
};

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────

const getNotifications = async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const logs = await AuditLog.find({
      action: 'customer_registered',
      createdAt: { $gte: since },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate({ path: 'user_id', select: 'name' })
      .lean();

    const unreadCount = logs.length;

    const items = logs.map(log => ({
      id: log._id,
      staffName: log.user_id?.name || 'Staff',
      customerName: log.details?.customer_id ? null : null,
      deviceModel: log.details?.device_model || '',
      accountNumber: log.details?.account_number || '',
      createdAt: log.createdAt,
    }));

    return res.status(200).json({ success: true, data: { unreadCount, items } });
  } catch (error) {
    logger.error('getNotifications error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── OVERDUE ACCOUNTS ────────────────────────────────────────────────────────

const getOverdueAccounts = async (req, res) => {
  try {
    const now = new Date();
    const plans = await InstallmentPlan.find({
      $or: [
        { status: 'defaulted' },
        { status: 'active', next_due_date: { $lt: now } },
      ],
    })
      .populate({ path: 'customer_id', select: 'full_name phone email' })
      .populate({ path: 'device_id', select: 'model lock_status serial_number' })
      .sort({ next_due_date: 1 })
      .lean();

    const accounts = plans.map(plan => {
      const dueDate = plan.next_due_date ? new Date(plan.next_due_date) : null;
      const daysOverdue = dueDate ? Math.floor((now - dueDate) / (1000 * 60 * 60 * 24)) : null;
      return {
        plan_id: plan._id,
        customer_id: plan.customer_id?._id,
        customer_name: plan.customer_id?.full_name || 'Unknown',
        customer_phone: plan.customer_id?.phone || '',
        customer_email: plan.customer_id?.email || '',
        device_model: plan.device_id?.model || 'iPhone',
        device_id: plan.device_id?._id,
        lock_status: plan.device_id?.lock_status || 'unlocked',
        serial_number: plan.device_id?.serial_number || '',
        installment_amount: plan.installment_amount || 0,
        remaining_balance: plan.remaining_balance || 0,
        next_due_date: plan.next_due_date,
        days_overdue: daysOverdue,
        plan_status: plan.status,
      };
    });

    return res.status(200).json({
      success: true,
      data: { accounts, total: accounts.length },
    });
  } catch (error) {
    logger.error('getOverdueAccounts error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── REVENUE FORECAST ────────────────────────────────────────────────────────

const getRevenueForecast = async (req, res) => {
  try {
    const now = new Date();
    const sixMonthsLater = new Date(now);
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

    const plans = await InstallmentPlan.find({
      status: { $in: ['active', 'defaulted'] },
    }).lean();

    // Build 6-month buckets
    const forecast = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-GH', { month: 'short', year: 'numeric' });
      forecast[key] = { month: key, label, projected_revenue: 0, payment_count: 0 };
    }

    for (const plan of plans) {
      const items = plan.schedule || [];
      for (const item of items) {
        if (item.paid || !item.due_date) continue;
        const dueDate = new Date(item.due_date);
        if (dueDate < now || dueDate > sixMonthsLater) continue;
        const key = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`;
        if (forecast[key]) {
          forecast[key].projected_revenue += item.amount || plan.installment_amount || 0;
          forecast[key].payment_count += 1;
        }
      }
    }

    const forecastData = Object.values(forecast);
    const totalProjected = forecastData.reduce((s, m) => s + m.projected_revenue, 0);

    return res.status(200).json({
      success: true,
      data: { forecast: forecastData, total_projected: totalProjected },
    });
  } catch (error) {
    logger.error('getRevenueForecast error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── SEND PAYMENT REMINDER ────────────────────────────────────────────────────

const sendCustomerReminder = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const plan = await InstallmentPlan.findOne({
      customer_id: customer._id,
      status: { $in: ['active', 'defaulted'] },
    })
      .populate({ path: 'device_id', select: 'model' })
      .lean();

    if (!plan) {
      return res.status(404).json({ success: false, message: 'No active plan found for this customer.' });
    }

    const reminderDetails = {
      deviceModel: plan.device_id?.model || 'iPhone',
      installmentAmount: plan.installment_amount,
      remainingBalance: plan.remaining_balance,
      nextDueDate: plan.next_due_date,
      isOverdue: plan.status === 'defaulted' || new Date(plan.next_due_date) < new Date(),
    };

    let emailSent = false;
    let smsSent = false;

    try {
      const { sendPaymentReminderEmail } = require('../utils/email');
      await sendPaymentReminderEmail(customer.email, customer.full_name, reminderDetails);
      emailSent = true;
    } catch (emailErr) {
      logger.error('sendCustomerReminder email error:', emailErr.message);
    }

    if (customer.phone) {
      try {
        await sendPaymentReminderSMS(customer.phone, customer.full_name, reminderDetails);
        smsSent = true;
      } catch (smsErr) {
        logger.error('sendCustomerReminder SMS error:', smsErr.message);
      }
    }

    await AuditLog.create({
      user_id: req.user._id,
      action: 'payment_reminder_sent',
      target_user_id: customer.user_id,
      details: { customer_id: customer._id, plan_id: plan._id, email_sent: emailSent, sms_sent: smsSent },
    });

    const channels = [emailSent && 'email', smsSent && 'SMS'].filter(Boolean).join(' & ');
    const message = channels
      ? `Payment reminder sent via ${channels}.`
      : 'Reminder logged, but notification could not be sent. Check server settings.';
    return res.status(200).json({ success: true, message });
  } catch (error) {
    logger.error('sendCustomerReminder error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── EXPORT TRANSACTIONS CSV ─────────────────────────────────────────────────

const exportTransactions = async (req, res) => {
  try {
    const filter = {};
    const fromDate = req.query.from || req.query.from_date;
    const toDate = req.query.to || req.query.to_date;
    if (fromDate || toDate) {
      filter.payment_date = {};
      if (fromDate) filter.payment_date.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        filter.payment_date.$lte = end;
      }
    }

    const payments = await Payment.find(filter)
      .populate({ path: 'customer_id', select: 'full_name phone email' })
      .sort({ payment_date: -1 })
      .lean();

    const rows = payments.map(p => [
      p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GH') : '',
      `"${p.customer_id?.full_name || ''}"`,
      `"${p.customer_id?.phone || ''}"`,
      p.amount || 0,
      `"${p.payment_method || ''}"`,
      `"${p.paystack_reference || ''}"`,
      p.paystack_status === 'success' ? 'Paid' : (p.paystack_status || 'Paid'),
    ].join(','));

    const csv = ['Date,Customer,Phone,Amount (GHS),Method,Reference,Status', ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="transactions_export.csv"`);
    return res.send(csv);
  } catch (error) {
    logger.error('exportTransactions error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── EXPORT CUSTOMERS CSV ────────────────────────────────────────────────────

const exportCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({})
      .populate({ path: 'user_id', select: 'account_number email' })
      .lean();

    const plans = await InstallmentPlan.find({}).lean();
    const planMap = {};
    for (const p of plans) {
      planMap[p.customer_id.toString()] = p;
    }

    const rows = customers.map(c => {
      const plan = planMap[c._id.toString()];
      return [
        `"${c.full_name || ''}"`,
        `"${c.user_id?.account_number || ''}"`,
        `"${c.email || ''}"`,
        `"${c.phone || ''}"`,
        `"${c.location || ''}"`,
        `"${c.district || ''}"`,
        `"${c.region || ''}"`,
        plan ? Number(plan.remaining_balance || 0).toFixed(2) : '0.00',
        plan ? (plan.status || 'active') : 'no plan',
        plan?.next_due_date ? new Date(plan.next_due_date).toLocaleDateString('en-GH') : '',
      ].join(',');
    });

    const csv = ['Name,Account No,Email,Phone,Location,District,Region,Remaining Balance (GHS),Plan Status,Next Due Date', ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="customers_export.csv"');
    return res.send(csv);
  } catch (error) {
    logger.error('exportCustomers error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── LOCK/UNLOCK CUSTOMER DEVICE ─────────────────────────────────────────────

const lockCustomerDevice = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const plan = await InstallmentPlan.findOne({ customer_id: customer._id }).lean();
    if (!plan || !plan.device_id) return res.status(404).json({ success: false, message: 'No device found for this customer.' });

    const device = await Device.findById(plan.device_id);
    if (!device) return res.status(404).json({ success: false, message: 'Device not found.' });

    // A remote lock is only real if the device has a UDID linked to SimpleMDM.
    if (!device.udid) {
      return res.status(400).json({
        success: false,
        message: 'This device has no UDID saved, so it cannot be locked remotely. Add the UDID from SimpleMDM to the device record first.',
      });
    }

    // Send the actual lock command FIRST — only mark it locked if it went out.
    let supervised = null;
    try {
      const r = await mdmLock(device.udid);
      supervised = r?.supervised;
      logger.info(`[MDM] Lock command sent for UDID ${device.udid} (supervised: ${supervised})`);
    } catch (mdmErr) {
      logger.error(`[MDM] Lock failed for UDID ${device.udid}:`, mdmErr.message);
      return res.status(502).json({
        success: false,
        message: `Could not lock the device: ${mdmErr.message}. Check the UDID matches SimpleMDM and that SIMPLEMDM_API_KEY is set on the server.`,
      });
    }

    device.lock_status = 'locked';
    await device.save();

    const mdmResult = 'sent';
    await AuditLog.create({
      user_id: req.user._id,
      action: 'device_lock',
      device_udid: device.udid,
      target_user_id: customer.user_id,
      details: { device_id: device._id, customer_id: customer._id, reason: req.body.reason || 'Manual lock by admin', mdm: mdmResult, supervised },
    });

    if (customer.phone) {
      sendDeviceLockedSMS(customer.phone, customer.full_name, device.model).catch(e =>
        logger.error('[SMS] Lock notification failed:', e.message)
      );
      sendDeviceLockedWhatsApp(customer.phone, customer.full_name, device.model).catch(e =>
        logger.error('[WhatsApp] Lock notification failed:', e.message)
      );
    }
    if (customer.email) {
      sendLockNotificationEmail(customer.email, customer.full_name, device.model).catch(e =>
        logger.error('[Email] Lock notification failed:', e.message)
      );
    }

    const note = supervised === false
      ? ' Note: this iPhone is not supervised, so this is a basic screen lock the customer can dismiss with their passcode. Supervise the device for a lock they cannot remove.'
      : '';
    return res.status(200).json({ success: true, message: 'Lock command sent to the device.' + note, mdm: mdmResult, supervised });
  } catch (error) {
    logger.error('lockCustomerDevice error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const unlockCustomerDevice = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const plan = await InstallmentPlan.findOne({ customer_id: customer._id }).lean();
    if (!plan || !plan.device_id) return res.status(404).json({ success: false, message: 'No device found for this customer.' });

    const device = await Device.findById(plan.device_id);
    if (!device) return res.status(404).json({ success: false, message: 'Device not found.' });

    if (!device.udid) {
      return res.status(400).json({
        success: false,
        message: 'This device has no UDID saved, so it cannot be unlocked remotely. Add the UDID from SimpleMDM to the device record first.',
      });
    }

    // Send the actual unlock command FIRST — only mark it unlocked if it went out.
    try {
      await mdmUnlock(device.udid);
      logger.info(`[MDM] Unlock command sent for UDID ${device.udid}`);
    } catch (mdmErr) {
      logger.error(`[MDM] Unlock failed for UDID ${device.udid}:`, mdmErr.message);
      return res.status(502).json({
        success: false,
        message: `Could not unlock the device: ${mdmErr.message}. Check the UDID matches SimpleMDM and that SIMPLEMDM_API_KEY is set on the server.`,
      });
    }

    device.lock_status = 'unlocked';
    await device.save();

    const mdmResult = 'sent';
    await AuditLog.create({
      user_id: req.user._id,
      action: 'device_unlock',
      device_udid: device.udid,
      target_user_id: customer.user_id,
      details: { device_id: device._id, customer_id: customer._id, reason: req.body.reason || 'Manual unlock by admin', mdm: mdmResult },
    });

    if (customer.phone) {
      sendDeviceUnlockedSMS(customer.phone, customer.full_name, device.model).catch(e =>
        logger.error('[SMS] Unlock notification failed:', e.message)
      );
      sendDeviceUnlockedWhatsApp(customer.phone, customer.full_name, device.model).catch(e =>
        logger.error('[WhatsApp] Unlock notification failed:', e.message)
      );
    }
    if (customer.email) {
      sendDeviceUnlockedEmail(customer.email, customer.full_name, device.model).catch(e =>
        logger.error('[Email] Unlock notification failed:', e.message)
      );
    }

    return res.status(200).json({ success: true, message: 'Unlock command sent to the device.', mdm: mdmResult });
  } catch (error) {
    logger.error('unlockCustomerDevice error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getPublicSettings = () => ({
  business_name: appSettings.business_name,
  contact_phone: appSettings.contact_phone,
  contact_email: appSettings.contact_email,
  whatsapp_number: appSettings.whatsapp_number,
  contact_address: appSettings.contact_address,
});

// ─── BACKUP ──────────────────────────────────────────────────────────────────
const downloadBackup = async (req, res) => {
  try {
    const [customers, devices, plans, payments, staff] = await Promise.all([
      Customer.find().select('-photos').lean(),
      Device.find().lean(),
      InstallmentPlan.find().lean(),
      Payment.find().lean(),
      User.find({ role: { $in: ['admin', 'staff'] } }).select('-password').lean(),
    ]);

    const backup = {
      exported_at: new Date().toISOString(),
      exported_by: req.user?.email || 'admin',
      counts: {
        customers: customers.length,
        devices: devices.length,
        installment_plans: plans.length,
        payments: payments.length,
        staff: staff.length,
      },
      data: { customers, devices, installment_plans: plans, payments, staff },
    };

    const filename = `tritechhub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).json(backup);
  } catch (error) {
    logger.error('downloadBackup error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate backup.' });
  }
};

// ─── GLOBAL SEARCH ───────────────────────────────────────────────────────────

const globalSearch = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) {
      return res.status(200).json({ success: true, data: { customers: [], devices: [], payments: [] } });
    }

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const [customers, devices, payments] = await Promise.all([
      Customer.find({
        $or: [{ full_name: regex }, { phone: regex }, { email: regex }, { ghana_card_id: regex }],
      })
        .select('full_name phone email ghana_card_id createdAt')
        .limit(8).lean(),

      Device.find({
        $or: [{ model: regex }, { serial_number: regex }, { imei: regex }],
      })
        .select('model serial_number imei lock_status sold_status')
        .limit(8).lean(),

      Payment.find({ paystack_reference: regex })
        .populate({ path: 'customer_id', select: 'full_name' })
        .select('amount payment_date paystack_reference payment_method')
        .limit(8).lean(),
    ]);

    return res.status(200).json({ success: true, data: { customers, devices, payments } });
  } catch (error) {
    logger.error('globalSearch error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── PDF RECEIPT ─────────────────────────────────────────────────────────────

const generateReceipt = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate({ path: 'user_id', select: 'account_number email' })
      .populate({ path: 'created_by', select: 'name staff_id' })
      .lean();

    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const [plan, payments] = await Promise.all([
      InstallmentPlan.findOne({ customer_id: customer._id })
        .populate({ path: 'device_id', select: 'model price serial_number imei' })
        .lean(),
      Payment.find({ customer_id: customer._id }).sort({ payment_date: 1 }).lean(),
    ]);

    const settings = await Settings.getSingleton();
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${customer.full_name.replace(/\s+/g, '-')}.pdf"`);
    doc.pipe(res);

    const primaryColor = '#16a34a';
    const lightGray = '#f3f4f6';
    const darkText = '#111827';
    const mutedText = '#6b7280';

    // ── Header ──
    doc.rect(0, 0, doc.page.width, 80).fill(primaryColor);
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
      .text(settings.business_name || 'Tritech Hub iOS', 50, 25);
    doc.fontSize(10).font('Helvetica')
      .text('Installment Agreement & Receipt', 50, 52);
    if (settings.contact_phone) {
      doc.text(`Tel: ${settings.contact_phone}`, doc.page.width - 180, 35, { width: 130, align: 'right' });
    }
    doc.moveDown(3);

    // ── Customer Info ──
    doc.fillColor(darkText).fontSize(13).font('Helvetica-Bold').text('Customer Information', 50, 100);
    doc.moveTo(50, 116).lineTo(doc.page.width - 50, 116).strokeColor(primaryColor).lineWidth(1.5).stroke();

    const infoY = 125;
    doc.fontSize(10).font('Helvetica');
    const col2 = doc.page.width / 2 + 10;

    const drawRow = (label, value, x, y) => {
      doc.fillColor(mutedText).text(label, x, y, { width: 120 });
      doc.fillColor(darkText).text(value || '—', x + 125, y, { width: 170 });
    };

    drawRow('Full Name', customer.full_name, 50, infoY);
    drawRow('Phone', customer.phone, 50, infoY + 18);
    drawRow('Email', customer.email || '—', 50, infoY + 36);
    drawRow('Ghana Card ID', customer.ghana_card_id || '—', 50, infoY + 54);
    drawRow('Account Number', customer.user_id?.account_number || '—', col2, infoY);
    drawRow('Registered', customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-GH') : '—', col2, infoY + 18);
    drawRow('By Staff', customer.created_by?.name || '—', col2, infoY + 36);

    // ── Device & Plan ──
    if (plan) {
      const device = plan.device_id;
      doc.moveDown(4);
      doc.fillColor(darkText).fontSize(13).font('Helvetica-Bold').text('Device & Installment Plan');
      doc.moveTo(50, doc.y + 2).lineTo(doc.page.width - 50, doc.y + 2).strokeColor(primaryColor).lineWidth(1.5).stroke();
      doc.moveDown(0.5);

      const py = doc.y;
      doc.fontSize(10).font('Helvetica');
      drawRow('Device Model', device?.model || '—', 50, py);
      drawRow('Serial Number', device?.serial_number || '—', 50, py + 18);
      drawRow('IMEI', device?.imei || '—', 50, py + 36);
      drawRow('Device Price', `GHS ${Number(plan.total_price).toLocaleString()}`, col2, py);
      drawRow('Down Payment', `GHS ${Number(plan.down_payment).toLocaleString()}`, col2, py + 18);
      drawRow('Installment Amount', `GHS ${Number(plan.installment_amount).toLocaleString()}`, col2, py + 36);
      drawRow('Frequency', (plan.frequency || '').charAt(0).toUpperCase() + (plan.frequency || '').slice(1), 50, py + 54);
      drawRow('Total Payments', `${plan.total_payments}`, col2, py + 54);
      drawRow('Plan Status', (plan.status || '').toUpperCase(), 50, py + 72);
      drawRow('Remaining Balance', `GHS ${Number(plan.remaining_balance).toLocaleString()}`, col2, py + 72);
    }

    // ── Payment History ──
    if (payments.length > 0) {
      doc.moveDown(5);
      doc.fillColor(darkText).fontSize(13).font('Helvetica-Bold').text('Payment History');
      doc.moveTo(50, doc.y + 2).lineTo(doc.page.width - 50, doc.y + 2).strokeColor(primaryColor).lineWidth(1.5).stroke();
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const cols = [50, 160, 280, 380, 480];
      const headers = ['Date', 'Amount (GHS)', 'Method', 'Reference', 'Status'];

      // Table header
      doc.rect(50, tableTop, doc.page.width - 100, 20).fill(lightGray);
      doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold');
      headers.forEach((h, i) => doc.text(h, cols[i], tableTop + 5, { width: 100 }));

      let rowY = tableTop + 22;
      doc.font('Helvetica').fontSize(9);
      payments.forEach((p, idx) => {
        if (idx % 2 === 0) doc.rect(50, rowY - 2, doc.page.width - 100, 16).fill('#f9fafb');
        doc.fillColor(darkText);
        doc.text(p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GH') : '—', cols[0], rowY, { width: 105 });
        doc.text(`GHS ${Number(p.amount).toLocaleString()}`, cols[1], rowY, { width: 115 });
        doc.text(p.payment_method === 'manual_cash' ? 'Cash' : 'Paystack', cols[2], rowY, { width: 95 });
        doc.text(p.paystack_reference || '—', cols[3], rowY, { width: 95 });
        doc.text('Paid', cols[4], rowY, { width: 60 });
        rowY += 18;

        if (rowY > doc.page.height - 100) { doc.addPage(); rowY = 50; }
      });

      const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
      doc.moveDown(1);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryColor)
        .text(`Total Paid: GHS ${totalPaid.toLocaleString()}`, { align: 'right' });
    }

    // ── Footer ──
    doc.moveDown(3);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor('#e5e7eb').lineWidth(1).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor(mutedText).font('Helvetica')
      .text(`Generated by ${settings.business_name || 'Tritech Hub iOS'} on ${new Date().toLocaleString('en-GH')}`, { align: 'center' })
      .text('This document is system-generated and serves as an official record.', { align: 'center' });

    doc.end();
  } catch (error) {
    logger.error('generateReceipt error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to generate receipt.' });
    }
  }
};

// ─── REPOSSESS DEVICE ────────────────────────────────────────────────────────

const repossessDevice = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

    const plan = await InstallmentPlan.findOne({ customer_id: customer._id });
    if (!plan) return res.status(404).json({ success: false, message: 'No installment plan found for this customer.' });

    // Repossession is an admin action guarded by a confirmation. Block it only
    // for plans that are already finished — otherwise let the admin repossess
    // any account that is behind (active/overdue/defaulted or a locked device),
    // since the scheduler that sets 'defaulted' may not have run.
    if (plan.status === 'completed') {
      return res.status(400).json({ success: false, message: 'This plan is fully paid — the device cannot be repossessed.' });
    }
    if (plan.status === 'repossessed') {
      return res.status(400).json({ success: false, message: 'This device has already been repossessed.' });
    }

    const device = await Device.findById(plan.device_id);
    if (!device) return res.status(404).json({ success: false, message: 'Device not found.' });

    device.lock_status = 'unlocked';
    device.sold_status = 'available';
    device.assigned_to = null;
    await device.save();

    plan.status = 'repossessed';
    await plan.save();

    await AuditLog.create({
      user_id: req.user._id,
      action: 'device_repossessed',
      details: {
        customer_id: customer._id,
        customer_name: customer.full_name,
        device_id: device._id,
        device_model: device.model,
        plan_id: plan._id,
      },
      ip_address: req.ip,
    });

    logger.info(`Device repossessed: ${device.model} from ${customer.full_name}`);

    return res.status(200).json({
      success: true,
      message: `Device "${device.model}" has been repossessed and is now available for resale.`,
    });
  } catch (error) {
    logger.error('repossessDevice error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── STAFF COMMISSIONS ───────────────────────────────────────────────────────
// Commission = (phones a staff sold − phones already paid for) × rate per phone.

const getCommissions = async (req, res) => {
  try {
    const staff = await User.find({ role: 'staff' })
      .select('name staff_id phone email commission_per_sale').lean();

    const rows = await Promise.all(staff.map(async (s) => {
      const rate = Number(s.commission_per_sale) || 100;
      const totalSales = await Customer.countDocuments({ created_by: s._id });
      const paidAgg = await CommissionPayout.aggregate([
        { $match: { staff_id: s._id, status: 'success' } },
        { $group: { _id: null, paidCount: { $sum: '$sales_count' }, paidAmount: { $sum: '$amount' } } },
      ]);
      const paidCount = paidAgg[0]?.paidCount || 0;
      const paidAmount = paidAgg[0]?.paidAmount || 0;
      const owedCount = Math.max(0, totalSales - paidCount);
      return {
        staff_id: s._id,
        name: s.name,
        staff_code: s.staff_id,
        phone: s.phone || '',
        rate,
        total_sales: totalSales,
        paid_count: paidCount,
        paid_amount: paidAmount,
        owed_count: owedCount,
        owed_amount: owedCount * rate,
      };
    }));

    return res.status(200).json({ success: true, data: { commissions: rows } });
  } catch (error) {
    logger.error('getCommissions error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const payCommission = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { momo_number, network } = req.body;

    if (!momo_number || !network) {
      return res.status(400).json({ success: false, message: 'MoMo number and network are required.' });
    }

    const staff = await User.findOne({ _id: staffId, role: 'staff' }).select('name staff_id commission_per_sale');
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found.' });

    const rate = Number(staff.commission_per_sale) || 100;

    const totalSales = await Customer.countDocuments({ created_by: staff._id });
    const paidAgg = await CommissionPayout.aggregate([
      { $match: { staff_id: staff._id, status: 'success' } },
      { $group: { _id: null, paidCount: { $sum: '$sales_count' } } },
    ]);
    const paidCount = paidAgg[0]?.paidCount || 0;
    const owedCount = Math.max(0, totalSales - paidCount);
    const amount = owedCount * rate;

    if (owedCount <= 0 || amount <= 0) {
      return res.status(400).json({ success: false, message: 'No commission is owed to this staff member.' });
    }

    const reference = `COMM-${staff._id}-${Date.now()}`;

    // Auto-send via Paystack Transfers only works on a REGISTERED Paystack
    // business (starter accounts can't do third-party payouts). Enable it with
    // ENABLE_PAYSTACK_PAYOUTS=true once your Paystack business is verified.
    // Otherwise this records the commission as paid and you send it via MoMo.
    const autoSend = process.env.ENABLE_PAYSTACK_PAYOUTS === 'true';
    let recipientCode = null, transferCode = null, payoutStatus = 'success';

    if (autoSend) {
      let transfer;
      try {
        recipientCode = await createTransferRecipient({
          name: staff.name,
          account_number: String(momo_number).trim(),
          bank_code: String(network).trim(),
        });
        transfer = await initiateTransfer({ amount, recipient: recipientCode, reason: `Commission: ${owedCount} phone(s)`, reference });
      } catch (err) {
        const pmsg = err?.response?.data?.message || err.message;
        logger.error('payCommission transfer error for staff %s: %s', staff._id, pmsg);
        // Nothing is recorded, so the commission stays owed and can be retried.
        return res.status(502).json({
          success: false,
          message: `Payout failed: ${pmsg}. Your Paystack account may need to be a registered business with Transfers enabled and OTP off.`,
        });
      }
      const st = transfer?.data?.status;
      if (st === 'otp') {
        return res.status(400).json({
          success: false,
          message: 'Your Paystack account requires OTP for transfers. Disable "OTP for transfers" in Paystack settings to auto-send, then try again.',
        });
      }
      transferCode = transfer?.data?.transfer_code;
      payoutStatus = st === 'failed' ? 'failed' : (st === 'success' ? 'success' : 'pending');
    }

    const payout = await CommissionPayout.create({
      staff_id: staff._id,
      amount,
      sales_count: owedCount,
      rate,
      status: payoutStatus,
      momo_number: String(momo_number).trim(),
      network: String(network).trim(),
      paystack_transfer_code: transferCode,
      paystack_reference: reference,
      recipient_code: recipientCode,
      paid_by: req.user._id,
      notes: autoSend ? undefined : 'Recorded as paid — sent manually via MoMo',
    });

    await AuditLog.create({
      user_id: req.user._id,
      action: 'commission_paid',
      target_user_id: staff._id,
      details: { amount, sales_count: owedCount, rate, status: payout.status, reference },
      ip_address: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: autoSend
        ? (payout.status === 'success'
            ? `Sent GHS ${amount.toLocaleString()} to ${staff.name}.`
            : `Payout of GHS ${amount.toLocaleString()} is processing (${payout.status}).`)
        : `Recorded GHS ${amount.toLocaleString()} as paid to ${staff.name}. Send it to ${String(momo_number).trim()} via MoMo.`,
      data: { payout },
    });
  } catch (error) {
    logger.error('payCommission error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getPublicSettings,
  getDashboard,
  getCustomers,
  getCustomerDetail,
  updateCustomer,
  deleteCustomer,
  getStaff,
  addStaff,
  updateStaff,
  deleteStaff,
  getStaffSales,
  updateStaffCommissionRate,
  getCommissions,
  payCommission,
  getDevices,
  getDeviceSales,
  addDevice,
  updateDevice,
  deleteDevice,
  lockDevice: lockDeviceHandler,
  unlockDevice: unlockDeviceHandler,
  getTransactions,
  getReports,
  getAuditLogs,
  resetCustomerPassword,
  getSettings,
  updateSettings,
  clearAllData,
  getNotifications,
  getOverdueAccounts,
  getRevenueForecast,
  sendCustomerReminder,
  exportTransactions,
  exportCustomers,
  lockCustomerDevice,
  unlockCustomerDevice,
  downloadBackup,
  globalSearch,
  generateReceipt,
  repossessDevice,
};
