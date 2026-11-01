const express = require('express');
const rateLimit = require('express-rate-limit');
const { getPayInfo, initPayLink, verifyPayLink } = require('../controllers/payLinkController');

// Public "Pay now" link endpoints — no login, so keep them rate-limited.
const router = express.Router();
const payLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please wait a few minutes.' },
});

router.get('/:token', payLimiter, getPayInfo);
router.post('/:token/initialize', payLimiter, initPayLink);
router.get('/:token/verify/:reference', payLimiter, verifyPayLink);

module.exports = router;
