const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { authenticate } = require('../middleware/auth');
const { requireLevel } = require('../middleware/rbac');
const { auditLog } = require('../middleware/auditLogger');
const {
  getCreditAgreements, createCreditAgreement, getCreditAgreement,
  updateCreditAgreement, recordPayment, generatePDF,
} = require('../controllers/creditAgreementsController');

// Multer setup for customer photo
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_PATH || './uploads');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `customer-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5242880 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  },
});

// Manager (2) and above
const managerPlus = [authenticate, requireLevel(2)];

router.use(managerPlus);

router.get('/', getCreditAgreements);

router.post(
  '/',
  upload.single('customer_photo'),
  [
    body('customer_name').notEmpty().withMessage('Customer name is required.'),
    body('customer_phone').notEmpty().withMessage('Customer phone is required.'),
    body('total_amount').isNumeric({ min: 0.01 }).withMessage('Total amount must be positive.'),
  ],
  auditLog('CREATE_CREDIT_AGREEMENT', (req) => ({ customer: req.body.customer_name, amount: req.body.total_amount })),
  createCreditAgreement
);

router.get('/:id', getCreditAgreement);
router.get('/:id/pdf', generatePDF);

router.put(
  '/:id',
  auditLog('UPDATE_CREDIT_AGREEMENT', (req) => ({ agreement_id: req.params.id })),
  updateCreditAgreement
);

router.post(
  '/:id/payment',
  [body('amount').isNumeric({ min: 0.01 }).withMessage('Payment amount must be positive.')],
  auditLog('CREDIT_AGREEMENT_PAYMENT', (req) => ({ agreement_id: req.params.id, amount: req.body.amount })),
  recordPayment
);

module.exports = router;
