const express = require('express');
const rateLimit = require('express-rate-limit');
const { getPayInfo, initPayLink, verifyPayLink, findPayLink } = require('../controllers/payLinkController');

// Public "Pay now" link endpoints — no login, so keep them rate-limited.
const router = express.Router();
const payLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please wait a few minutes.' },
});

// Account number + phone → the Pay-now page (stricter limit: it's a lookup).
const findLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many tries. Please wait 15 minutes.' },
});
router.post('/find', findLimiter, findPayLink);
router.get('/:token', payLimiter, getPayInfo);
router.post('/:token/initialize', payLimiter, initPayLink);
router.get('/:token/verify/:reference', payLimiter, verifyPayLink);

module.exports = router;
