const AuditLog = require('../models/AuditLog');

/**
 * auditLog(action, getDetails)
 * Middleware factory that logs actions to the AuditLog collection.
 *
 * @param {string} action - Action name, e.g. 'CREATE_SALE', 'DELETE_USER'
 * @param {Function} getDetails - Optional async function (req, body) => {} for extra details
 *
 * Usage:
 *   router.post('/', authenticate, auditLog('CREATE_PRODUCT'), controller)
 */
const auditLog = (action, getDetails = null) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = async function (body) {
      originalJson(body);

      // Only log successful operations (2xx status codes)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        try {
          let details = {};

          if (getDetails && typeof getDetails === 'function') {
            details = await getDetails(req, body);
          } else {
            details = {
              params: req.params,
              body_keys: Object.keys(req.body || {}),
            };
          }

          await AuditLog.create({
            user_id: req.user._id,
            username: req.user.username,
            role: req.user.role,
            action,
            details,
            ip_address: req.ip || req.connection?.remoteAddress || 'unknown',
            timestamp: new Date(),
          });
        } catch (err) {
          // Never let audit logging crash the request
          console.error('Audit log error:', err.message);
        }
      }
    };

    next();
  };
};

module.exports = { auditLog };
