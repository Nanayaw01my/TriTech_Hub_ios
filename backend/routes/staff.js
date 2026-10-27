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

module.exports = router;
