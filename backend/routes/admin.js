const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const {
  getDashboard,
  getCustomers,
  getCustomerDetail,
  updateCustomer,
  deleteCustomer,
  getStaff,
  addStaff,
  updateStaff,
  deleteStaff,
  getDevices,
  getDeviceSales,
  addDevice,
  updateDevice,
  deleteDevice,
  lockDevice,
  unlockDevice,
  getTransactions,
  getReports,
  getAuditLogs,
  resetCustomerPassword,
  getSettings,
  updateSettings,
  getStaffSales,
  updateStaffCommissionRate,
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
} = require('../controllers/adminController');

// Apply authentication and admin authorization to all routes
router.use(authenticate, authorize('admin'));

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
router.get('/dashboard', getDashboard);
router.get('/overdue-accounts', getOverdueAccounts);

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
router.get('/customers', getCustomers);
router.get('/customers/export', exportCustomers);
router.get('/customers/:id', getCustomerDetail);
router.put(
  '/customers/:id',
  [
    param('id').isMongoId().withMessage('Invalid customer ID.'),
  ],
  updateCustomer
);
router.delete(
  '/customers/:id',
  [param('id').isMongoId().withMessage('Invalid customer ID.')],
  deleteCustomer
);
router.post(
  '/reset-customer-password/:id',
  [
    param('id').isMongoId().withMessage('Invalid customer ID.'),
    body('new_password')
      .notEmpty()
      .withMessage('New password is required.')
      .isLength({ max: 5 })
      .withMessage('Customer password must be at most 5 characters.'),
  ],
  resetCustomerPassword
);
router.post('/customers/:id/lock', [param('id').isMongoId()], lockCustomerDevice);
router.post('/customers/:id/unlock', [param('id').isMongoId()], unlockCustomerDevice);
router.post('/customers/:id/remind', [param('id').isMongoId()], sendCustomerReminder);

// ─── STAFF ────────────────────────────────────────────────────────────────────
router.get('/staff', getStaff);
router.post(
  '/staff',
  [
    body('name').notEmpty().trim().withMessage('Name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    body('password').notEmpty().isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    body('phone').optional().trim(),
  ],
  addStaff
);
router.put(
  '/staff/:id',
  [param('id').isMongoId().withMessage('Invalid staff ID.')],
  updateStaff
);
router.delete(
  '/staff/:id',
  [param('id').isMongoId().withMessage('Invalid staff ID.')],
  deleteStaff
);
router.get('/staff-sales', getStaffSales);
router.patch(
  '/staff/:id/commission',
  [param('id').isMongoId().withMessage('Invalid staff ID.')],
  updateStaffCommissionRate
);

// ─── DEVICES ──────────────────────────────────────────────────────────────────
router.get('/devices', getDevices);
router.get('/device-sales', getDeviceSales);
router.post(
  '/devices',
  [
    body('model').notEmpty().trim().withMessage('Device model is required.'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number.'),
    body('serial_number').optional().trim(),
    body('udid').optional().trim(),
    body('imei').optional().trim(),
  ],
  addDevice
);
router.put(
  '/devices/:id',
  [param('id').isMongoId().withMessage('Invalid device ID.')],
  updateDevice
);
router.delete(
  '/devices/:id',
  [param('id').isMongoId().withMessage('Invalid device ID.')],
  deleteDevice
);
router.post(
  '/devices/:id/lock',
  [param('id').isMongoId().withMessage('Invalid device ID.')],
  lockDevice
);
router.post(
  '/devices/:id/unlock',
  [param('id').isMongoId().withMessage('Invalid device ID.')],
  unlockDevice
);

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
router.get('/transactions/export', exportTransactions);
router.get('/transactions', getTransactions);

// ─── REPORTS ──────────────────────────────────────────────────────────────────
router.get('/reports', getReports);
router.get('/revenue-forecast', getRevenueForecast);

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────
router.get('/audit-logs', getAuditLogs);

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
router.get('/notifications', getNotifications);

// ─── BACKUP ───────────────────────────────────────────────────────────────────
router.get('/backup', downloadBackup);

// ─── GLOBAL SEARCH ────────────────────────────────────────────────────────────
router.get('/search', globalSearch);

// ─── PDF RECEIPT ──────────────────────────────────────────────────────────────
router.get('/customers/:id/receipt', generateReceipt);

// ─── DANGER ZONE ──────────────────────────────────────────────────────────────
router.delete('/clear-all-data', clearAllData);

module.exports = router;
