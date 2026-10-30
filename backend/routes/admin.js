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
  getDeviceProvisioning,
  getDeviceLocations,
  getStockEnrollment,
  getEnrolledDevices,
  releaseCustomerDevice,
  getPendingActivations,
  approvePlan,
  updateStaffIdentity,
  assignStock,
  setStockPrice,
  mergeDuplicateDevices,
  getFrp,
  addFrpAccount,
  removeFrpAccount,
  getPaystackBanks,
  setStaffPayout,
  removeStaffPayout,
  returnPlan,
  unenrollDevice,
  returnDeviceToStock,
  getTransactions,
  getReports,
  getAuditLogs,
  resetCustomerPassword,
  getSettings,
  updateSettings,
  getStaffSales,
  updateStaffCommissionRate,
  getCommissions,
  payCommission,
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
} = require('../controllers/adminController');

// Apply authentication and admin authorization to all routes
router.use(authenticate, authorize('admin', 'superadmin'));

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
router.post('/customers/:id/release', [param('id').isMongoId()], releaseCustomerDevice);
router.get('/stock-enrollment', getStockEnrollment);
router.get('/enrolled-devices', getEnrolledDevices);
router.get('/activations', getPendingActivations);
router.post('/plans/:id/approve', [param('id').isMongoId()], approvePlan);
router.get('/paystack/banks', getPaystackBanks);
router.put('/staff/:id/payout', [param('id').isMongoId()], setStaffPayout);
router.delete('/staff/:id/payout', [param('id').isMongoId()], removeStaffPayout);
router.post('/plans/:id/return', [param('id').isMongoId()], returnPlan);
router.post('/devices/assign', assignStock);
router.post('/devices/price', setStockPrice);
router.post('/devices/merge-duplicates', mergeDuplicateDevices);
router.get('/frp', getFrp);
router.post('/frp', addFrpAccount);
router.delete('/frp/:googleId', removeFrpAccount);
router.post('/devices/:id/return-to-stock', [param('id').isMongoId()], returnDeviceToStock);
router.post('/devices/:id/unenroll', [param('id').isMongoId()], unenrollDevice);
router.post('/customers/:id/remind', [param('id').isMongoId()], sendCustomerReminder);
router.post('/customers/:id/repossess', [param('id').isMongoId().withMessage('Invalid customer ID.')], repossessDevice);

// ─── STAFF ────────────────────────────────────────────────────────────────────
router.get('/staff', getStaff);
router.post(
  '/staff',
  [
    body('name').notEmpty().trim().withMessage('Name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required.'),
    body('password').notEmpty().isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
    body('phone').optional().trim(),
    body('ghana_card_id').notEmpty().trim().withMessage('Ghana Card number is required.'),
  ],
  addStaff
);
router.put('/staff/:id/identity', [param('id').isMongoId()], updateStaffIdentity);
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
router.get('/commissions', getCommissions);
router.post(
  '/commissions/:staffId/pay',
  [param('staffId').isMongoId().withMessage('Invalid staff ID.')],
  payCommission
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
router.get(
  '/devices/:id/provision',
  [param('id').isMongoId().withMessage('Invalid device ID.')],
  getDeviceProvisioning
);
router.get(
  '/devices/:id/locations',
  [param('id').isMongoId().withMessage('Invalid device ID.')],
  getDeviceLocations
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
