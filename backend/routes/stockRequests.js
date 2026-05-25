const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { requireLevel } = require('../middleware/rbac');
const { auditLog } = require('../middleware/auditLogger');
const {
  getStockRequests, createStockRequest, getStockRequest,
  approveStockRequest, rejectStockRequest, deleteStockRequest,
} = require('../controllers/stockRequestsController');

// Manager (2) and above can create and view
router.use(authenticate, requireLevel(2));

router.get('/', getStockRequests);

router.post(
  '/',
  [body('items').isArray({ min: 1 }).withMessage('At least one item is required.')],
  auditLog('CREATE_STOCK_REQUEST'),
  createStockRequest
);

router.get('/:id', getStockRequest);

// Only CEO (3) and Super Admin (4) can approve/reject
router.put('/:id/approve', requireLevel(3), auditLog('APPROVE_STOCK_REQUEST'), approveStockRequest);
router.put('/:id/reject', requireLevel(3), auditLog('REJECT_STOCK_REQUEST'), rejectStockRequest);
router.delete('/:id', auditLog('DELETE_STOCK_REQUEST'), deleteStockRequest);

module.exports = router;
