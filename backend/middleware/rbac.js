/**
 * Role-Based Access Control middleware for ITTEK Solution.
 *
 * Role levels:
 *   Super Admin = 4
 *   CEO         = 3
 *   Manager     = 2
 *   Sales       = 1
 */

const ROLE_LEVELS = {
  'Super Admin': 4,
  CEO: 3,
  Manager: 2,
  Sales: 1,
};

/**
 * requireRoles(...roles)
 * Returns middleware that checks req.user.role is in the allowed roles list.
 *
 * Usage: requireRoles('Super Admin', 'CEO')
 */
const requireRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}.`,
      });
    }

    next();
  };
};

/**
 * requireLevel(minLevel)
 * Returns middleware that requires the user's role level to be >= minLevel.
 *
 * Usage: requireLevel(3) // CEO and Super Admin only
 */
const requireLevel = (minLevel) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }

    const userLevel = ROLE_LEVELS[req.user.role] || 0;
    if (userLevel < minLevel) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }

    next();
  };
};

module.exports = { requireRoles, requireLevel, ROLE_LEVELS };
