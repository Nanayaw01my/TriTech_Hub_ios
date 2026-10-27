const { validationResult } = require('express-validator');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Device = require('../models/Device');
const InstallmentPlan = require('../models/InstallmentPlan');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const { generateAccountNumber } = require('../utils/accountGenerator');
const { initializePayment } = require('../utils/paystack');
const { sendAdminSaleNotificationEmail, sendCustomerWelcomeEmail } = require('../utils/email');
const { sendAdminSaleSMS, sendAdminSaleWhatsApp, sendCustomerWelcomeSMS } = require('../utils/sms');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { uploadBase64 } = require('../utils/cloudinary');
const { processSuccessfulPayment } = require('./paymentController');

// Upload a base64-encoded image to Cloudinary, return the secure URL (or null).
const saveBase64Image = async (base64String, fieldName, customerId = '') => {
  const folder = `tritech/customers/${customerId || 'general'}`;
  return uploadBase64(base64String, folder);
};

/**
 * Calculate the installment schedule array given a start date, frequency, and total payments.
 * Returns an array of { due_date, amount, paid: false, payment_id: null }
 */
const buildSchedule = (startDate, frequency, totalPayments, installmentAmount) => {
  const schedule = [];
  let currentDate = new Date(startDate);

  for (let i = 0; i < totalPayments; i++) {
    // Calculate this payment's due date
    let dueDate;
    if (i === 0) {
      dueDate = new Date(currentDate);
    } else {
      dueDate = new Date(schedule[i - 1].due_date);
      if (frequency === 'daily') {
        dueDate.setDate(dueDate.getDate() + 1);
      } else if (frequency === 'weekly') {
        dueDate.setDate(dueDate.getDate() + 7);
      } else {
        // monthly
        dueDate.setMonth(dueDate.getMonth() + 1);
      }
    }

    schedule.push({
      due_date: dueDate,
      amount: installmentAmount,
      paid: false,
      payment_id: null,
    });
  }

  return schedule;
};

/**
 * Calculate the end date of the plan based on frequency and total payments.
 */
const calculateEndDate = (startDate, frequency, totalPayments) => {
  const endDate = new Date(startDate);
  if (frequency === 'daily') {
    endDate.setDate(endDate.getDate() + (totalPayments - 1));
  } else if (frequency === 'weekly') {
    endDate.setDate(endDate.getDate() + (totalPayments - 1) * 7);
  } else {
    endDate.setMonth(endDate.getMonth() + (totalPayments - 1));
  }
  return endDate;
};

/**
 * GET /api/staff/customers
 * List customers created by this staff member.
 */
const getMyCustomers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const { search } = req.query;

    const filter = { created_by: req.user._id };

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      const matchingUsers = await User.find({
        $or: [{ email: searchRegex }, { account_number: searchRegex }, { phone: searchRegex }],
      }).select('_id');

      const userIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { full_name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { ghana_card_id: searchRegex },
        { user_id: { $in: userIds } },
      ];

      // Remove created_by from filter.$or check — we keep it via filter.created_by
      // Actually we need to combine: created_by AND ($or search)
      const createdByFilter = { created_by: req.user._id };
      delete filter.$or;
      Object.assign(filter, createdByFilter);
      filter.$or = [
        { full_name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { ghana_card_id: searchRegex },
        { user_id: { $in: userIds } },
      ];
    }

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .populate({ path: 'user_id', select: 'account_number email is_active' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(filter),
    ]);

    // Enrich with active plan status
    const enriched = await Promise.all(
      customers.map(async (c) => {
        const plan = await InstallmentPlan.findOne(
          { customer_id: c._id },
          { status: 1, next_due_date: 1, remaining_balance: 1 }
        ).lean();
        // Ghana Card ID images are admin-only — never expose them to staff.
        if (c.photos) {
          delete c.photos.ghana_card_front;
          delete c.photos.ghana_card_back;
        }
        return { ...c, installment_plan: plan };
      })
    );

    return res.status(200).json({
      success: true,
      message: 'Customers retrieved.',
      data: {
        customers: enriched,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    logger.error('Staff getMyCustomers error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/staff/customers/precheck
 * Validates that a customer can be registered BEFORE any down payment is taken,
 * so the pay-first flow never charges for a registration that would then fail.
 * Creates nothing.
 */
const precheckCustomer = async (req, res) => {
  try {
    const { email, device_id, device_model, device_price, password, down_payment, serial_number, udid } = req.body;

    if (!password || String(password).length > 5) {
      return res.status(400).json({ success: false, message: 'Customer password must be between 1 and 5 characters.' });
    }
    if (email) {
      const existingEmail = await User.findOne({ email: String(email).toLowerCase().trim() });
      if (existingEmail) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      }
    }
    if (serial_number && String(serial_number).trim()) {
      const dup = await Device.findOne({ serial_number: String(serial_number).trim() });
      if (dup) {
        return res.status(409).json({ success: false, message: 'A device with this serial number already exists.' });
      }
    }
    if (udid && String(udid).trim()) {
      const dup = await Device.findOne({ udid: String(udid).trim() });
      if (dup) {
        return res.status(409).json({ success: false, message: 'A device with this UDID already exists.' });
      }
    }
    if (device_id) {
      const d = await Device.findById(device_id);
      if (!d) {
        return res.status(400).json({ success: false, message: 'Selected device not found. Please choose another.' });
      }
    } else if (!device_model) {
      return res.status(400).json({ success: false, message: 'Please select a device.' });
    }
    const dp = Number(down_payment) || 0;
    if (dp <= 0) {
      return res.status(400).json({ success: false, message: 'A deposit (down payment) is required.' });
    }
    if (dp >= Number(device_price)) {
      return res.status(400).json({ success: false, message: 'Down payment must be less than the device price.' });
    }

    return res.status(200).json({ success: true, ok: true });
  } catch (err) {
    logger.error('Staff precheckCustomer error: %s', err.message);
    return res.status(500).json({ success: false, message: 'Could not verify details. Please try again.' });
  }
};

/**
 * POST /api/staff/customers
 * Full customer registration flow.
 */
const addCustomer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const {
      full_name,
      email,
      phone,
      password,
      ghana_card_id,
      occupation,
      // flat income fields from frontend
      income_amount,
      income_source,
      // flat location fields from frontend
      region,
      district,
      location: locationTown,
      landmark,
      gps_address,
      // flat guarantor fields from frontend
      guarantor_name,
      guarantor_phone,
      guarantor_ghana_card_id,
      guarantor_relationship,
      // device fields
      device_id: device_id_param,
      device_model,
      device_price,
      serial_number,
      udid,
      down_payment,
      down_payment_reference,
      // accept payment_frequency (frontend) or frequency
      payment_frequency,
      frequency: frequencyField,
      duration,
    } = req.body;

    const frequency = payment_frequency || frequencyField || 'monthly';

    // --- 1. Password is optional ---
    // If the DSR supplies one it must be 1-5 chars. If omitted, auto-generate a
    // short numeric PIN so the portal account still exists; the customer can set
    // their own later via "forgot password".
    let customerPassword = password;
    if (customerPassword) {
      if (customerPassword.length > 5) {
        return res.status(400).json({
          success: false,
          message: 'Customer password must be between 1 and 5 characters.',
        });
      }
    } else {
      customerPassword = String(Math.floor(10000 + Math.random() * 90000)); // 5-digit PIN
    }

    // --- 1b. Guarantor details are all required ---
    if (!guarantor_name || !guarantor_phone || !guarantor_ghana_card_id || !guarantor_relationship) {
      return res.status(400).json({
        success: false,
        message: 'All guarantor details (name, phone, Ghana Card ID, relationship) are required.',
      });
    }

    // --- 1c. A deposit is required (it's collected via Paystack after approval) ---
    if (!(Number(down_payment) > 0)) {
      return res.status(400).json({ success: false, message: 'A deposit (down payment) is required.' });
    }

    // --- 2. Resolve the device for this sale ---
    // Two modes:
    //  a) Enrolled stock: device_id is a pre-enrolled, unassigned phone — sell
    //     THAT exact phone so its lock-agent enrollment carries over. Don't clone.
    //  b) Catalog: device_id/model is a catalog entry — clone a fresh per-sale
    //     device record (serial/IMEI come from the form for the physical phone).
    const cleanSerial = (serial_number && String(serial_number).trim()) || undefined;
    const cleanUdid = (udid && String(udid).trim()) || undefined;
    let device;
    if (device_id_param) {
      const picked = await Device.findById(device_id_param);
      if (!picked) {
        return res.status(400).json({ success: false, message: 'Selected device not found. Please choose another.' });
      }
      if (picked.agent?.enrolled && !picked.assigned_to) {
        // Selling a pre-enrolled stock phone — use it directly.
        device = picked;
        device.price = Number(device_price) || device.price || 0;
        device.sold_status = 'sold';
        if (cleanSerial) device.serial_number = cleanSerial;
        if (cleanUdid) device.udid = cleanUdid;
        await device.save();
      } else {
        device = await Device.create({
          model: picked.model, color: picked.color, storage: picked.storage,
          price: Number(device_price) || picked.price,
          imei: picked.imei || null,
          serial_number: cleanSerial, udid: cleanUdid,
          sold_status: 'sold',
        });
      }
    } else {
      let catalogDevice = await Device.findOne({ model: device_model, sold_status: 'available' });
      if (!catalogDevice) {
        catalogDevice = await Device.create({ model: device_model, price: Number(device_price) || 0 });
      }
      device = await Device.create({
        model: catalogDevice.model, color: catalogDevice.color, storage: catalogDevice.storage,
        price: Number(device_price) || catalogDevice.price,
        imei: catalogDevice.imei || null,
        serial_number: cleanSerial, udid: cleanUdid,
        sold_status: 'sold',
      });
    }

    // --- 3. Check email uniqueness ---
    const existingEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingEmail) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // --- 4. Generate account number ---
    const accountNumber = await generateAccountNumber();

    // --- 5. Create User account ---
    const newUser = await User.create({
      name: full_name.trim(),
      email: email.toLowerCase().trim(),
      password: customerPassword,
      phone: phone?.trim(),
      role: 'customer',
      account_number: accountNumber,
    });

    // --- 6. Upload photos to Cloudinary, store permanent URLs ---
    const toBase64DataUrl = (file) => {
      if (!file) return null;
      const buf = file.buffer || require('fs').readFileSync(file.path);
      return `data:${file.mimetype || 'image/jpeg'};base64,${buf.toString('base64')}`;
    };

    const folder = `tritech/customers/${newUser._id}`;
    const photoFields = ['ghana_card_front', 'ghana_card_back', 'customer_photo', 'guarantor_photo', 'signature'];
    const photos = {};
    await Promise.all(photoFields.map(async (field) => {
      const raw = req.files?.[field]?.[0]
        ? toBase64DataUrl(req.files[field][0])
        : (req.body[field]?.startsWith('data:') ? req.body[field] : null);
      if (raw) photos[field] = await saveBase64Image(raw, field, newUser._id);
    }));

    let proof_of_income = null;
    const rawProof = req.files?.proof_of_income?.[0]
      ? toBase64DataUrl(req.files.proof_of_income[0])
      : (req.body.proof_of_income?.startsWith('data:') ? req.body.proof_of_income : null);
    if (rawProof) proof_of_income = await saveBase64Image(rawProof, 'proof_of_income', newUser._id);

    // --- 7. Create Customer record ---
    const newCustomer = await Customer.create({
      user_id: newUser._id,
      full_name: full_name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone?.trim(),
      ghana_card_id,
      photos,
      occupation,
      income: { amount: Number(income_amount) || 0, source: income_source || '' },
      location: { region, district, town: locationTown, landmark, gps_address },
      guarantor: {
        full_name: guarantor_name,
        phone: guarantor_phone,
        ghana_card_id: guarantor_ghana_card_id,
        relationship: guarantor_relationship,
      },
      proof_of_income,
      created_by: req.user._id,
    });

    // --- 8. Calculate installment plan ---
    const downPaymentAmount = parseFloat(down_payment) || 0;
    const totalPrice = device.price;
    const remainingBalance = totalPrice - downPaymentAmount;

    if (remainingBalance < 0) {
      // Rollback user creation
      await User.findByIdAndDelete(newUser._id);
      await Customer.findByIdAndDelete(newCustomer._id);
      return res.status(400).json({
        success: false,
        message: 'Down payment cannot exceed device price.',
      });
    }

    // Use staff-selected duration; fall back to sensible defaults
    const frequencyDefaults = { daily: 90, weekly: 13, monthly: 12 };
    const totalPayments = (Number(duration) > 0) ? Number(duration) : (frequencyDefaults[frequency] || 12);

    // Calculate installment amount (round to 2 decimal places)
    const installmentAmount = Math.ceil((remainingBalance / totalPayments) * 100) / 100;

    // Provisional dates — the real schedule clock only starts when the admin
    // ACTIVATES the sale. Stored now so the (required) fields are valid.
    const startDate = new Date();
    const nextDueDate = new Date(startDate);
    const endDate = calculateEndDate(startDate, frequency, totalPayments);

    // Generate payment schedule
    const schedule = buildSchedule(startDate, frequency, totalPayments, installmentAmount);

    // --- 9. Create InstallmentPlan (PENDING until admin activates) ---
    const plan = await InstallmentPlan.create({
      customer_id: newCustomer._id,
      device_id: device._id,
      created_by: req.user._id,
      down_payment: downPaymentAmount,
      total_price: totalPrice,
      remaining_balance: remainingBalance,
      installment_amount: installmentAmount,
      frequency,
      total_payments: totalPayments,
      payments_made: 0,
      start_date: startDate,
      next_due_date: nextDueDate,
      end_date: endDate,
      status: 'pending',
      schedule,
    });

    // --- 10. Link device to customer ---
    await Device.findByIdAndUpdate(device._id, { assigned_to: newCustomer._id });

    // --- 11. No payment is taken at registration. After the admin approves the
    //         sale, the DSR collects this deposit via Paystack; that payment
    //         starts the plan and unlocks the phone (utils/planActivation). ---

    // --- 12. Create audit log ---
    await AuditLog.create({
      user_id: req.user._id,
      action: 'customer_registered',
      target_user_id: newUser._id,
      details: {
        customer_id: newCustomer._id,
        account_number: accountNumber,
        device_id: device._id,
        device_model: device.model,
        plan_id: plan._id,
        down_payment: downPaymentAmount,
        total_price: totalPrice,
        frequency,
      },
      ip_address: req.ip,
    });

    // --- 12. Notify admin of new sale (fire-and-forget) ---
    ;(async () => {
      try {
        const [staffUser, adminUser] = await Promise.all([
          User.findById(req.user._id).select('name staff_id branch'),
          User.findOne({ role: 'admin' }).select('email phone'),
        ]);

        const salePayload = {
          staffName: staffUser?.name || req.user.name,
          staffId: staffUser?.staff_id,
          branch: staffUser?.branch || null,
          customerName: newCustomer.full_name,
          customerPhone: newCustomer.phone,
          deviceModel: device.model,
          downPayment: downPaymentAmount,
          totalPrice,
          installmentAmount,
          frequency,
          totalPayments,
        };

        // Email notification
        const adminEmail = process.env.ADMIN_EMAIL || adminUser?.email;
        if (adminEmail) {
          try {
            await sendAdminSaleNotificationEmail(adminEmail, salePayload);
            logger.info('[Sale notify] Email sent to:', adminEmail);
          } catch (e) {
            logger.error('[Sale notify] Email failed:', e?.message || e);
          }
        }

        // SMS + WhatsApp notification to admin
        const adminPhone = process.env.ADMIN_PHONE || adminUser?.phone;
        if (adminPhone) {
          await sendAdminSaleSMS(adminPhone, salePayload).catch(e =>
            logger.error('[Sale notify] SMS failed:', e.message)
          );
          logger.info('[Sale notify] SMS sent to:', adminPhone);

          await sendAdminSaleWhatsApp(adminPhone, salePayload).catch(e =>
            logger.error('[Sale notify] WhatsApp failed:', e.message)
          );
          logger.info('[Sale notify] WhatsApp sent to:', adminPhone);
        }

        // Welcome email + SMS to customer
        if (newCustomer.email) {
          try {
            await sendCustomerWelcomeEmail(newCustomer.email, newCustomer.full_name, newUser.account_number);
            logger.info('[Sale notify] Welcome email sent to:', newCustomer.email);
          } catch (e) {
            logger.error('[Sale notify] Welcome email failed:', e?.message || e);
          }
        }
        if (newCustomer.phone) {
          await sendCustomerWelcomeSMS(
            newCustomer.phone,
            newCustomer.full_name,
            newUser.account_number,
            process.env.FRONTEND_URL || 'dandorsolar.site'
          ).catch(e => logger.error('[Sale notify] Welcome SMS failed:', e.message));
        }
      } catch (err) {
        logger.error('[Sale notify] Notification error:', err.message);
      }
    })();

    // --- 13. Return full data ---
    const populatedCustomer = await Customer.findById(newCustomer._id)
      .populate({ path: 'user_id', select: '-password' })
      .lean();

    const populatedPlan = await InstallmentPlan.findById(plan._id)
      .populate({ path: 'device_id' })
      .lean();

    return res.status(201).json({
      success: true,
      message: 'Customer registered successfully.',
      data: {
        customer: populatedCustomer,
        user: {
          _id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          account_number: accountNumber,
          role: newUser.role,
        },
        installment_plan: populatedPlan,
      },
    });
  } catch (error) {
    logger.error('Staff addCustomer error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate entry: email or account number already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/staff/customers/:id
 * Full customer detail for a customer created by this staff member (or admin).
 */
const getCustomerDetail = async (req, res) => {
  try {
    const filter = { _id: req.params.id };

    // Staff can only view their own customers; admin can view all
    if (req.user.role === 'staff') {
      filter.created_by = req.user._id;
    }

    const customer = await Customer.findOne(filter)
      .populate({ path: 'user_id', select: '-password' })
      .populate({ path: 'created_by', select: 'name email staff_id' })
      .lean();

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found or access denied.' });
    }

    // Ghana Card ID images are sensitive — restrict them to admins.
    // Staff upload them during registration but cannot view them afterward.
    if (req.user.role === 'staff' && customer.photos) {
      delete customer.photos.ghana_card_front;
      delete customer.photos.ghana_card_back;
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
    logger.error('Staff getCustomerDetail error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/staff/customers/:id/payments
 * Payment history for a customer.
 */
const getCustomerPayments = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role === 'staff') filter.created_by = req.user._id;

    const customer = await Customer.findOne(filter).lean();
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found or access denied.' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      Payment.find({ customer_id: customer._id })
        .sort({ payment_date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payment.countDocuments({ customer_id: customer._id }),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Customer payments retrieved.',
      data: {
        payments,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    logger.error('Staff getCustomerPayments error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/staff/enrolled-stock
 * Pre-enrolled phones available to sell (unassigned), for the sale picker.
 */
const getEnrolledStock = async (req, res) => {
  try {
    const devices = await Device.find({ 'agent.enrolled': true, assigned_to: null })
      .select('model imei serial_number agent createdAt')
      .sort({ createdAt: -1 })
      .lean();
    const mapped = devices.map((d) => ({
      _id: d._id,
      model: d.model,
      imei: d.imei || '',
      serial_number: d.serial_number || '',
      online: !!d.agent?.last_heartbeat && (Date.now() - new Date(d.agent.last_heartbeat).getTime() < 20 * 60 * 1000),
    }));
    return res.status(200).json({ success: true, data: { devices: mapped, total: mapped.length } });
  } catch (error) {
    logger.error('getEnrolledStock error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/staff/customers/:id/record-cash
 * Record an installment payment collected in cash at the counter.
 */
const recordCashPayment = async (req, res) => {
  try {
    const amt = Number(req.body?.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: 'Enter a valid payment amount.' });
    }

    const filter = { _id: req.params.id };
    if (req.user.role === 'staff') filter.created_by = req.user._id;
    const customer = await Customer.findOne(filter).lean();
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found or access denied.' });
    }

    const plan = await InstallmentPlan.findOne({ customer_id: customer._id }).lean();
    if (!plan) return res.status(404).json({ success: false, message: 'No installment plan for this customer.' });
    if (plan.status === 'pending' || plan.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: plan.status === 'pending'
          ? 'This sale is still awaiting admin approval — no payments can be recorded yet.'
          : 'Collect the deposit through Paystack first; installments start after that.',
      });
    }
    if (plan.status === 'completed' || plan.remaining_balance <= 0) {
      return res.status(400).json({ success: false, message: 'This plan is already fully paid.' });
    }

    const device = plan.device_id ? await Device.findById(plan.device_id).lean() : null;
    const paidBy = { user_id: req.user._id, user_role: req.user.role, name: req.user.name };

    const result = await processSuccessfulPayment({
      paystackData: { amount: Math.round(amt * 100), paid_at: Date.now(), reference: null, status: 'manual_cash' },
      customer,
      plan,
      device,
      paidBy,
      recordedBy: req.user._id,
      notes: `Cash payment recorded by ${req.user.name || 'staff'}`,
      method: 'manual_cash',
    });

    return res.status(200).json({
      success: true,
      message: result.isCompleted
        ? 'Cash payment recorded — plan fully paid, device unlocked.'
        : 'Cash payment recorded.',
      data: {
        amount: amt,
        remaining_balance: result.newRemainingBalance,
        payments_made: result.newPaymentsMade,
        completed: result.isCompleted,
      },
    });
  } catch (error) {
    logger.error('Staff recordCashPayment error: %s', error.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/staff/customers/:id/payment
 * Initialize Paystack payment on behalf of a customer.
 */
const makePaymentForCustomer = async (req, res) => {
  try {
    const filter = { _id: req.params.id };
    if (req.user.role === 'staff') filter.created_by = req.user._id;

    const customer = await Customer.findOne(filter)
      .populate({ path: 'user_id', select: 'email account_number' })
      .lean();

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found or access denied.' });
    }

    const plan = await InstallmentPlan.findOne({ customer_id: customer._id, status: 'active' })
      .populate({ path: 'device_id', select: 'model' })
      .lean();

    if (!plan) {
      return res.status(404).json({ success: false, message: 'No active installment plan found for this customer.' });
    }

    if (plan.remaining_balance <= 0) {
      return res.status(400).json({ success: false, message: 'Installment plan is already fully paid.' });
    }

    const amountToPay = req.body.amount || plan.installment_amount;
    const reference = `TH-${uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase()}`;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const callbackUrl = `${frontendUrl}/payment/verify?reference=${reference}`;

    const paystackResponse = await initializePayment({
      email: customer.email || customer.user_id?.email,
      amount: amountToPay,
      reference,
      callback_url: callbackUrl,
      metadata: {
        customer_id: customer._id.toString(),
        customer_name: customer.full_name,
        account_number: customer.user_id?.account_number,
        plan_id: plan._id.toString(),
        device_model: plan.device_id?.model,
        initiated_by: req.user._id.toString(),
        initiated_by_role: req.user.role,
      },
    });

    if (!paystackResponse.status) {
      return res.status(502).json({ success: false, message: 'Failed to initialize payment with Paystack.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment initialized. Redirect customer to authorization URL.',
      data: {
        authorization_url: paystackResponse.data.authorization_url,
        reference,
        amount: amountToPay,
        customer: {
          name: customer.full_name,
          email: customer.email,
          account_number: customer.user_id?.account_number,
        },
      },
    });
  } catch (error) {
    logger.error('Staff makePaymentForCustomer error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getAvailableDevices = async (req, res) => {
  try {
    const devices = await Device.find({ assigned_to: null })
      .select('model color storage price serial_number udid')
      .sort({ model: 1 });
    return res.status(200).json({ success: true, data: { devices } });
  } catch (error) {
    logger.error('Staff getAvailableDevices error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── STATS ───────────────────────────────────────────────────────────────────
const getStaffStats = async (req, res) => {
  try {
    const staffId = req.user._id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const myCustomerIds = await Customer.distinct('_id', { created_by: staffId });

    const [myCustomers, paymentsToday, overdue] = await Promise.all([
      Customer.countDocuments({ created_by: staffId }),
      Payment.countDocuments({
        customer_id: { $in: myCustomerIds },
        createdAt: { $gte: todayStart },
      }),
      InstallmentPlan.countDocuments({
        created_by: staffId,
        status: 'active',
        next_due_date: { $lt: new Date() },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        my_customers: myCustomers,
        payments_today: paymentsToday,
        overdue,
      },
    });
  } catch (error) {
    logger.error('getStaffStats error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getMyCustomers,
  precheckCustomer,
  addCustomer,
  getCustomerDetail,
  getCustomerPayments,
  makePaymentForCustomer,
  recordCashPayment,
  getEnrolledStock,
  getAvailableDevices,
  getStaffStats,
};
