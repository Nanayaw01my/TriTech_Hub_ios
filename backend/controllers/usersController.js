const { validationResult } = require('express-validator');
const User = require('../models/User');

const ROLE_LEVELS = { 'Super Admin': 4, CEO: 3, Manager: 2, Sales: 1 };

const canManage = (actorRole, targetRole) => {
  const actorLevel = ROLE_LEVELS[actorRole] || 0;
  const targetLevel = ROLE_LEVELS[targetRole] || 0;
  // Super Admin can manage anyone; CEO can manage Manager and Sales only
  if (actorRole === 'Super Admin') return true;
  if (actorRole === 'CEO') return targetLevel <= 2; // Manager=2, Sales=1
  return false;
};

/**
 * GET /api/users
 */
const getUsers = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'CEO') {
      filter.role = { $in: ['Manager', 'Sales'] };
    }

    const users = await User.find(filter).populate('created_by', 'username email').sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: users, count: users.length });
  } catch (err) {
    console.error('Get users error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * POST /api/users
 */
const createUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { username, email, password, role } = req.body;

    if (!canManage(req.user.role, role)) {
      return res.status(403).json({ success: false, message: 'You cannot create a user with that role.' });
    }

    const existing = await User.findOne({ $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }] });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Username or email already exists.' });
    }

    const user = await User.create({
      username,
      email,
      password,
      role,
      created_by: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully.',
      data: { id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Create user error:', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Username or email already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * GET /api/users/:id
 */
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('created_by', 'username email');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (!canManage(req.user.role, user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    console.error('Get user error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/users/:id
 */
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (!canManage(req.user.role, user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { username, email, role } = req.body;

    if (role && !canManage(req.user.role, role)) {
      return res.status(403).json({ success: false, message: 'Cannot assign that role.' });
    }

    if (username) user.username = username;
    if (email) user.email = email;
    if (role) user.role = role;

    await user.save();
    return res.status(200).json({ success: true, message: 'User updated.', data: user });
  } catch (err) {
    console.error('Update user error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * DELETE /api/users/:id
 */
const deleteUser = async (req, res) => {
  try {
    if (req.params.id === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (!canManage(req.user.role, user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    await User.findByIdAndDelete(req.params.id);
    return res.status(200).json({ success: true, message: 'User deleted.' });
  } catch (err) {
    console.error('Delete user error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/users/:id/toggle-active
 */
const toggleActive = async (req, res) => {
  try {
    if (req.params.id === String(req.user._id)) {
      return res.status(400).json({ success: false, message: 'Cannot deactivate your own account.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (!canManage(req.user.role, user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    user.is_active = !user.is_active;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `User ${user.is_active ? 'activated' : 'deactivated'} successfully.`,
      data: { is_active: user.is_active },
    });
  } catch (err) {
    console.error('Toggle active error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PUT /api/users/:id/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (!canManage(req.user.role, user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    user.password = new_password;
    await user.save();

    return res.status(200).json({ success: true, message: 'Password reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getUsers, createUser, getUser, updateUser, deleteUser, toggleActive, resetPassword };
