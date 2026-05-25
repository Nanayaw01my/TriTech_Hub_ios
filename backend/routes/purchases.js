const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { requireLevel } = require('../middleware/rbac');
const { auditLog } = require('../middleware/auditLogger');
const { getPurchases, createPurchase, getPurchase, deletePurchase } = require('../controllers/purchasesController');

const adminOnly = [authenticate, requireLevel(3)];

router.use(adminOnly);

router.get('/', getPurchases);

router.post(
  '/',
  [
    body('items').isArray({ min: 1 }).withMessage('Purchase must have at least one item.'),
  ],
  auditLog('CREATE_PURCHASE', (req) => ({ total_amount: req.body.total_amount, items_count: req.body.items?.length })),
  createPurchase
);

router.get('/:id', getPurchase);

router.delete(
  '/:id',
  auditLog('DELETE_PURCHASE', (req) => ({ purchase_id: req.params.id })),
  deletePurchase
);

module.exports = router;
