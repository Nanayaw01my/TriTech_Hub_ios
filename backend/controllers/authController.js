const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Customer = require('../models/Customer');
const PasswordReset = require('../models/PasswordReset');
const TempOTP = require('../models/TempOTP');
const AuditLog = require('../models/AuditLog');
const { sendPasswordResetEmail, sendAdminLoginOTPEmail } = require('../utils/email');
const { sendPasswordResetOTP } = require('../utils/sms');
const logger = require('../utils/logger');
const TokenBlacklist = require('../models/TokenBlacklist');

/**
 * POST /api/auth/login
 * Accept email OR account_number OR staff_id + password
 * Returns JWT token and user data with role.
 */
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { identifier, email, account_number, staff_id, password } = req.body;

    // Support both 'identifier' field and individual fields
    const loginIdentifier = identifier || email || account_number || staff_id;

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a login identifier (email, account number, or staff ID) and password.',
      });
    }

    // Build query: email is case-insensitive regex; account_number and staff_id are exact
    const escaped = loginIdentifier.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const query = {
      $or: [
        { email: { $regex: new RegExp(`^${escaped}$`, 'i') } },
        { username: { $regex: new RegExp(`^${escaped}$`, 'i') } },
        { account_number: loginIdentifier.trim() },
        { staff_id: loginIdentifier.trim() },
      ],
    };

    const user = await User.findOne(query).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.',
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
      });
    }

    // Generate JWT
    const token = user.generateAuthToken();

    // Return user data without password
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      staff_id: user.staff_id,
      account_number: user.account_number,
      is_active: user.is_active,
      created_at: user.created_at,
    };

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: userData,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login.',
    });
  }
};

/**
 * POST /api/auth/logout
 * Clears the token (client-side). Server-side we just confirm.
 */
const logout = async (req, res) => {
  try {
    // Blacklist the token so it can't be reused even before it expires
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
    if (token) {
      const decoded = jwt.decode(token);
      if (decoded?.exp) {
        await TokenBlacklist.create({
          token,
          expires_at: new Date(decoded.exp * 1000),
        }).catch(() => {}); // ignore duplicate key if already blacklisted
      }
    }

    res.clearCookie('token');
    return res.status(200).json({ success: true, message: 'Logged out successfully.', data: null });
  } catch (error) {
    logger.error('Logout error:', error);
    return res.status(500).json({ success: false, message: 'Server error during logout.' });
  }
};

/**
 * POST /api/auth/forgot-password
 * Generate reset token, save to PasswordReset, send reset email.
 */
const forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
        data: null,
      });
    }

    // Invalidate any existing reset tokens for this email
    await PasswordReset.updateMany(
      { email: email.toLowerCase().trim(), used: false },
      { used: true }
    );

    // Generate secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Save reset record
    await PasswordReset.create({
      email: email.toLowerCase().trim(),
      token: hashedToken,
      expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    });

    // Build reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(email.toLowerCase().trim())}`;

    // Send email
    try {
      await sendPasswordResetEmail(email, user.name, resetUrl);
    } catch (emailError) {
      logger.error('Failed to send password reset email:', emailError.message);
      // Don't expose email errors to the client
    }

    // Log this action
    await AuditLog.create({
      user_id: user._id,
      action: 'password_reset',
      details: { event: 'password_reset_requested', email: user.email },
      ip_address: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
      data: null,
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

/**
 * POST /api/auth/reset-password
 * Verify token, update password.
 */
const resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { token, email, password } = req.body;

    if (!token || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token, email, and new password are required.',
      });
    }

    // Hash the provided token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const resetRecord = await PasswordReset.findOne({
      email: email.toLowerCase().trim(),
      token: hashedToken,
      used: false,
      expires_at: { $gt: new Date() },
    });

    if (!resetRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token. Please request a new password reset.',
      });
    }

    // Find the user
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Update password (pre-save hook will hash it)
    user.password = password;
    await user.save();

    // Mark token as used
    resetRecord.used = true;
    await resetRecord.save();

    // Log this action
    await AuditLog.create({
      user_id: user._id,
      action: 'password_reset',
      details: { event: 'password_reset_completed', email: user.email },
      ip_address: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
      data: null,
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

/**
 * POST /api/auth/change-password
 * Authenticated user changes their own password.
 */
const changePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required.',
      });
    }

    // Fetch user with password
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    // Prevent setting the same password
    const isSame = await user.comparePassword(new_password);
    if (isSame) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from your current password.',
      });
    }

    // Update password
    user.password = new_password;
    await user.save();

    // Log this action
    await AuditLog.create({
      user_id: user._id,
      action: 'password_reset',
      details: { event: 'password_changed_by_user' },
      ip_address: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully.',
      data: null,
    });
  } catch (error) {
    logger.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

const formatPhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '233' + digits.slice(1);
  if (digits.length === 9) return '233' + digits;
  return digits;
};

const findUserByPhone = async (phone) => {
  const formatted = formatPhone(phone);
  if (!formatted) return null;

  // 1. Direct match — works for any legacy/unencrypted phone values.
  let user = await User.findOne({ phone: { $in: [phone, formatted] } });
  if (user) return user;
  const customer = await Customer.findOne({ phone: { $in: [phone, formatted] } });
  if (customer?.user_id) {
    user = await User.findById(customer.user_id);
    if (user) return user;
  }

  // 2. Encrypted phones can't be matched by an equality query (each value is
  //    encrypted with a random IV). Scan and compare the DECRYPTED phone
  //    (the models' post-find hook decrypts `phone` automatically).
  const matchesFormatted = (p) => {
    const f = formatPhone(p);
    return f && f === formatted;
  };

  const users = await User.find({ phone: { $exists: true, $ne: null } }).select('_id phone');
  const uMatch = users.find(u => matchesFormatted(u.phone));
  if (uMatch) return User.findById(uMatch._id);

  const customers = await Customer.find({ phone: { $exists: true, $ne: null } }).select('_id user_id phone');
  const cMatch = customers.find(c => matchesFormatted(c.phone));
  if (cMatch?.user_id) return User.findById(cMatch.user_id);

  return null;
};

/**
 * POST /api/auth/forgot-password-sms
 * Send a 6-digit OTP to the user's phone number.
 */
const forgotPasswordSMS = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const formatted = formatPhone(phone);
    if (!formatted) {
      return res.status(400).json({ success: false, message: 'Invalid phone number.' });
    }

    const user = await findUserByPhone(phone);

    // Always return success to prevent enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that number exists, a code has been sent.',
      });
    }

    // Invalidate existing OTPs for this phone
    await PasswordReset.updateMany({ phone: formatted, used: false }, { used: true });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

    await PasswordReset.create({
      phone: formatted,
      token: hashedOtp,
      expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    try {
      await sendPasswordResetOTP(formatted, otp);
    } catch (smsErr) {
      logger.error('OTP SMS error:', smsErr.message);
    }

    await AuditLog.create({
      user_id: user._id,
      action: 'password_reset',
      details: { event: 'otp_sent', phone: formatted },
      ip_address: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: 'If an account with that number exists, a code has been sent.',
    });
  } catch (error) {
    logger.error('forgotPasswordSMS error:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * POST /api/auth/reset-password-otp
 * Verify the 6-digit OTP and reset password.
 */
const resetPasswordOTP = async (req, res) => {
  try {
    const { phone, otp, password } = req.body;
    if (!phone || !otp || !password) {
      return res.status(400).json({ success: false, message: 'Phone, code, and new password are required.' });
    }

    const formatted = formatPhone(phone);
    const hashedOtp = crypto.createHash('sha256').update(otp.trim()).digest('hex');

    const record = await PasswordReset.findOne({
      phone: formatted,
      token: hashedOtp,
      used: false,
      expires_at: { $gt: new Date() },
    });

    if (!record) {
      return res.status(400).json({ success: false, message: 'Invalid or expired code. Please request a new one.' });
    }

    const foundUser = await findUserByPhone(phone);
    if (!foundUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Re-load with the password field (it is select:false) so the new password
    // is reliably tracked and hashed by the pre-save hook.
    const user = await User.findById(foundUser._id).select('+password');
    user.password = password;
    await user.save();

    record.used = true;
    await record.save();

    await AuditLog.create({
      user_id: user._id,
      action: 'password_reset',
      details: { event: 'otp_reset_completed', phone: formatted },
      ip_address: req.ip,
    });

    return res.status(200).json({ success: true, message: 'Password reset successfully.' });
  } catch (error) {
    logger.error('resetPasswordOTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

/**
 * POST /api/auth/verify-otp
 * Verify admin 2FA OTP and issue JWT.
 */
const verifyAdminOTP = async (req, res) => {
  try {
    const { userId, otp } = req.body;
    if (!userId || !otp) {
      return res.status(400).json({ success: false, message: 'User ID and verification code are required.' });
    }

    const otpHash = crypto.createHash('sha256').update(otp.trim()).digest('hex');

    const record = await TempOTP.findOne({
      user_id: userId,
      otp_hash: otpHash,
      used: false,
      expires_at: { $gt: new Date() },
    });

    if (!record) {
      return res.status(401).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    record.used = true;
    await record.save();

    const user = await User.findById(userId);
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
    }

    const token = user.generateAuthToken();
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      staff_id: user.staff_id,
      account_number: user.account_number,
      is_active: user.is_active,
      created_at: user.created_at,
    };

    await AuditLog.create({
      user_id: user._id,
      action: 'login',
      details: { event: 'admin_2fa_login_success', email: user.email },
      ip_address: req.ip,
    });

    logger.info(`Admin 2FA login success: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: { token, user: userData },
    });
  } catch (error) {
    logger.error('verifyAdminOTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/auth/profile
 * Update the authenticated user's name and/or email.
 * Requires current_password to confirm identity.
 */
const updateProfile = async (req, res) => {
  try {
    const { name, email, current_password } = req.body;

    if (!current_password) {
      return res.status(400).json({ success: false, message: 'Current password is required to save changes.' });
    }
    if (!name && !email) {
      return res.status(400).json({ success: false, message: 'Provide at least a name or email to update.' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    if (email && email.toLowerCase().trim() !== user.email) {
      const existing = await User.findOne({ email: email.toLowerCase().trim() });
      if (existing) {
        return res.status(409).json({ success: false, message: 'That email is already in use by another account.' });
      }
      user.email = email.toLowerCase().trim();
    }

    if (name && name.trim()) {
      user.name = name.trim();
    }

    await user.save();

    await AuditLog.create({
      user_id: user._id,
      action: 'profile_updated',
      details: { updated_fields: [...(name ? ['name'] : []), ...(email ? ['email'] : [])] },
      ip_address: req.ip,
    });

    logger.info(`Profile updated for ${user.email}`);

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          staff_id: user.staff_id,
          account_number: user.account_number,
          is_active: user.is_active,
        },
      },
    });
  } catch (error) {
    logger.error('updateProfile error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { login, logout, forgotPassword, resetPassword, changePassword, forgotPasswordSMS, resetPasswordOTP, verifyAdminOTP, updateProfile };
