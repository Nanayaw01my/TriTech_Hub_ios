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
} = require('../controllers/authController');

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

module.exports = router;
