const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadMultiplePhotos, handleUploadError } = require('../middleware/upload');
const {
  getMyCustomers,
  precheckCustomer,
  addCustomer,
  updateSale,
  getCustomerDetail,
  getCustomerPayments,
  makePaymentForCustomer,
  recordCashPayment,
  getEnrolledStock,
  getAvailableDevices,
  getStaffStats,
} = require('../controllers/staffController');

// Apply authentication and staff/admin authorization to all routes
router.use(authenticate, authorize('staff', 'admin'));

/**
 * GET /api/staff/devices
 * List available (unsold) devices for customer registration dropdown.
 */
router.get('/devices', getAvailableDevices);
router.get('/enrolled-stock', getEnrolledStock);

/**
 * GET /api/staff/stats
 * Dashboard stats for this staff member.
 */
router.get('/stats', getStaffStats);

/**
 * GET /api/staff/customers
 * List customers created by this staff member.
 */
router.get('/customers', getMyCustomers);

/**
 * POST /api/staff/customers/precheck
 * Validate a customer can be registered before taking a down payment.
 */
router.post('/customers/precheck', precheckCustomer);

/**
 * POST /api/staff/customers
 * Register a new customer with device and installment plan.
 * Supports multipart/form-data for photo uploads.
 */
// Same rules for registering a sale and correcting it.
const saleValidators = [
  body('full_name').notEmpty().trim().withMessage('Full name is required.'),
  // Email is optional (many customers have none); validated only if given.
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().withMessage('Enter a valid email or leave it blank.'),
  body('phone').notEmpty().trim().withMessage('Phone number is required.'),
  // Password is OPTIONAL. If given it must be 1-5 chars; if omitted the
  // backend auto-generates one so the customer portal account still exists.
  body('password')
    .optional({ checkFalsy: true })
    .isLength({ min: 1, max: 5 })
    .withMessage('Customer password must be between 1 and 5 characters.'),
  // Guarantor details are ALL required.
  body('guarantor_name').notEmpty().trim().withMessage("Guarantor's full name is required."),
  body('guarantor_phone').notEmpty().trim().withMessage("Guarantor's phone number is required."),
  body('guarantor_ghana_card_id').notEmpty().trim().withMessage("Guarantor's Ghana Card ID is required."),
  body('guarantor_relationship').notEmpty().trim().withMessage("Guarantor's relationship is required."),
  body('device_model').optional().trim(),
  body('down_payment')
    .isFloat({ min: 0.01 })
    .withMessage('A deposit (down payment) is required.'),
];

router.post(
  '/customers',
  uploadMultiplePhotos,
  handleUploadError,
  saleValidators,
  addCustomer
);

/**
 * PUT /api/staff/customers/:id
 * Correct a sale the admin sent back (or one still pending) and resubmit it.
 */
router.put(
  '/customers/:id',
  uploadMultiplePhotos,
  handleUploadError,
  [param('id').isMongoId().withMessage('Invalid customer ID.'), ...saleValidators],
  updateSale
);

/**
 * GET /api/staff/customers/:id
 * Get full customer detail.
 */
router.get(
  '/customers/:id',
  [param('id').isMongoId().withMessage('Invalid customer ID.')],
  getCustomerDetail
);

/**
 * GET /api/staff/customers/:id/payments
 * Get payment history for a customer.
 */
router.get(
  '/customers/:id/payments',
  [param('id').isMongoId().withMessage('Invalid customer ID.')],
  getCustomerPayments
);

/**
 * POST /api/staff/customers/:id/payment
 * Initialize a Paystack payment on behalf of a customer.
 */
router.post(
  '/customers/:id/payment',
  [
    param('id').isMongoId().withMessage('Invalid customer ID.'),
    body('amount').optional().isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0.'),
  ],
  makePaymentForCustomer
);

/**
 * POST /api/staff/customers/:id/record-cash
 * Record an installment payment collected in cash.
 */
router.post(
  '/customers/:id/record-cash',
  [
    param('id').isMongoId().withMessage('Invalid customer ID.'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0.'),
  ],
  recordCashPayment
);

// The customer's Pay-now link (to copy / send on WhatsApp) — own customers only.
router.get('/customers/:id/pay-link', async (req, res) => {
  try {
    const Customer = require('../models/Customer');
    const InstallmentPlan = require('../models/InstallmentPlan');
    const q = { _id: req.params.id, deleted_at: null };
    if (req.user.role === 'staff') q.created_by = req.user._id;
    const c = await Customer.findOne(q).select('_id').lean();
    if (!c) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const plan = await InstallmentPlan.findOne({ customer_id: c._id, status: { $in: ['active', 'defaulted'] } }).sort({ createdAt: -1 });
    if (!plan) return res.status(400).json({ success: false, message: 'This customer has no active plan to pay.' });
    const { ensurePayLink, amountDue } = require('../utils/payLink');
    const link = await ensurePayLink(plan);
    return res.status(200).json({ success: true, data: { token: plan.pay_token, url: `https://${link}`, amount_due: amountDue(plan) } });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Notes / follow-ups / customer history — a DSR sees only their own customers.
const notesApi = require('../utils/customerNotes');
router.get('/customers/:id/notes', (req, res) => notesApi.listHandler(req, res));
router.post('/customers/:id/notes', (req, res) => notesApi.addHandler(req, res));
router.patch('/notes/:id', (req, res) => notesApi.updateHandler(req, res));
router.get('/follow-ups', (req, res) => notesApi.followUpsHandler(req, res));
router.get('/customers/:id/timeline', (req, res) => notesApi.timelineHandler(req, res));

module.exports = router;
