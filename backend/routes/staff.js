const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadMultiplePhotos, handleUploadError } = require('../middleware/upload');
const {
  getMyCustomers,
  precheckCustomer,
  addCustomer,
  getCustomerDetail,
  getCustomerPayments,
  makePaymentForCustomer,
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
router.post(
  '/customers',
  uploadMultiplePhotos,
  handleUploadError,
  [
    body('full_name').notEmpty().trim().withMessage('Full name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    body('phone').notEmpty().trim().withMessage('Phone number is required.'),
    body('password')
      .notEmpty()
      .withMessage('Password is required.')
      .isLength({ min: 1, max: 5 })
      .withMessage('Customer password must be between 1 and 5 characters.'),
    body('device_model').notEmpty().trim().withMessage('Device model is required.'),
    body('down_payment')
      .isFloat({ min: 0 })
      .withMessage('Down payment must be a non-negative number.'),
  ],
  addCustomer
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

module.exports = router;
