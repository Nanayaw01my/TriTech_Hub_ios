const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { requireLevel } = require('../middleware/rbac');
const { auditLog } = require('../middleware/auditLogger');
const { getDebts, getDebt, getDebtSummary, recordPayment } = require('../controllers/debtsController');

// Manager (2) and above
const managerPlus = [authenticate, requireLevel(2)];

router.use(managerPlus);

router.get('/summary', getDebtSummary);
router.get('/', getDebts);
router.get('/:id', getDebt);

router.post(
  '/:id/payment',
  [
    body('amount').isNumeric({ min: 0.01 }).withMessage('Payment amount must be positive.'),
    body('payment_method').optional().isIn(['cash', 'card', 'mobile_money']),
  ],
  auditLog('DEBT_PAYMENT', (req) => ({ debt_id: req.params.id, amount: req.body.amount })),
  recordPayment
);

module.exports = router;
