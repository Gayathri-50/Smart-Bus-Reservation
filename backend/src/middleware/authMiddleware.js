const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getNormalizedRole = (user) => {
  if (typeof user?.getNormalizedRole === 'function') {
    return user.getNormalizedRole();
  }
  const r = String(user?.role || '').toUpperCase();
  if (r === 'ADMIN' || r === 'SUPER_ADMIN') return 'ADMIN';
  if (r === 'BUS_MANAGER') return 'BUS_MANAGER';
  if (r === 'BOOKING_MANAGER') return 'BOOKING_MANAGER';
  if (r === 'FINANCE_MANAGER') return 'FINANCE_MANAGER';
  if (r === 'MANAGER') return 'MANAGER';
  return 'CUSTOMER';
};

const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Not authorized, token missing' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the administrator.',
      });
    }

    req.user = user;
    req.userRole = getNormalizedRole(user);
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Not authorized, token invalid or expired' });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || getNormalizedRole(req.user) !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }

  next();
};

const requireManager = (req, res, next) => {
  const role = getNormalizedRole(req.user);
  const isManagerRole = ['MANAGER', 'BUS_MANAGER', 'BOOKING_MANAGER', 'FINANCE_MANAGER', 'ADMIN'].includes(role);
  if (!isManagerRole) {
    return res.status(403).json({
      success: false,
      message: 'Manager access required',
    });
  }

  next();
};

const requireRole = (...allowedRoles) => {
  const normalizedAllowed = allowedRoles.map((r) => r.toUpperCase());

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    const currentNormalizedRole = getNormalizedRole(req.user);
    const rawRole = String(req.user.role || '').toUpperCase();

    // SUPER_ADMIN and ADMIN always pass staff checks
    if (
      currentNormalizedRole === 'ADMIN' ||
      rawRole === 'ADMIN' ||
      rawRole === 'SUPER_ADMIN'
    ) {
      return next();
    }

    // Direct match against allowed roles
    if (
      normalizedAllowed.includes(rawRole) ||
      normalizedAllowed.includes(currentNormalizedRole)
    ) {
      return next();
    }

    // If 'MANAGER' was specified in allowedRoles, allow any manager role
    if (
      normalizedAllowed.includes('MANAGER') &&
      ['BUS_MANAGER', 'BOOKING_MANAGER', 'FINANCE_MANAGER', 'MANAGER'].includes(currentNormalizedRole)
    ) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${allowedRoles.join(', ')}`,
    });
  };
};

module.exports = authenticateUser;
module.exports.authenticateUser = authenticateUser;
module.exports.requireAdmin = requireAdmin;
module.exports.requireManager = requireManager;
module.exports.requireRole = requireRole;
module.exports.protect = authenticateUser;
module.exports.getNormalizedRole = getNormalizedRole;