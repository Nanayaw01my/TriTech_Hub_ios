const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const {
  login,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  forgotPasswordSMS,
  resetPasswordOTP,
  verifyAdminOTP,
  updateProfile,
} = require('../controllers/authController');

// Customer login with an SMS code (no password). Sending is limited per
// network (many customers share a mobile-data IP) and per number (in the
// controller); each code allows 5 wrong tries.
const rateLimit = require('express-rate-limit');
const { sendCustomerLoginCode, verifyCustomerLoginCode } = require('../controllers/authController');
const codeSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many code requests. Please wait 15 minutes.' },
});
const codeCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many tries. Please wait 15 minutes.' },
});
router.post('/customer-code', codeSendLimiter, sendCustomerLoginCode);
router.post('/customer-code/verify', codeCheckLimiter, verifyCustomerLoginCode);

/**
 * POST /api/auth/login
 * Login with email/account_number/staff_id + password
 */
router.post(
  '/login',
  [
    body('password')
      .notEmpty()
      .withMessage('Password is required.'),
  ],
  login
);

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticate, logout);

/**
 * POST /api/auth/forgot-password
 */
router.post(
  '/forgot-password',
  [
    body('email')
      .isEmail()
      .withMessage('A valid email address is required.')
      .normalizeEmail(),
  ],
  forgotPassword
);

/**
 * POST /api/auth/reset-password
 */
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required.'),
    body('email').isEmail().withMessage('Valid email is required.').normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('New password is required.')
      .isLength({ min: 1 })
      .withMessage('Password must be at least 1 character.'),
  ],
  resetPassword
);

/**
 * POST /api/auth/forgot-password-sms
 */
router.post(
  '/forgot-password-sms',
  [body('phone').notEmpty().withMessage('Phone number is required.')],
  forgotPasswordSMS
);

/**
 * POST /api/auth/reset-password-otp
 */
router.post(
  '/reset-password-otp',
  [
    body('phone').notEmpty().withMessage('Phone number is required.'),
    body('otp').notEmpty().isLength({ min: 6, max: 6 }).withMessage('Enter the 6-digit code.'),
    body('password').notEmpty().withMessage('New password is required.'),
  ],
  resetPasswordOTP
);

/**
 * POST /api/auth/change-password
 * Authenticated user changes their own password.
 */
router.post(
  '/change-password',
  authenticate,
  [
    body('current_password').notEmpty().withMessage('Current password is required.'),
    body('new_password')
      .notEmpty()
      .withMessage('New password is required.')
      .isLength({ min: 1 })
      .withMessage('New password must be at least 1 character.'),
  ],
  changePassword
);

/**
 * POST /api/auth/verify-otp
 * Verify admin 2FA code and receive JWT.
 */
router.post(
  '/verify-otp',
  [
    body('userId').notEmpty().withMessage('User ID is required.'),
    body('otp').notEmpty().isLength({ min: 6, max: 6 }).withMessage('Enter the 6-digit code.'),
  ],
  verifyAdminOTP
);

/**
 * PUT /api/auth/profile
 * Update authenticated user's name and/or email (requires current password).
 */
router.put(
  '/profile',
  authenticate,
  [
    body('current_password').notEmpty().withMessage('Current password is required.'),
  ],
  updateProfile
);

module.exports = router;
