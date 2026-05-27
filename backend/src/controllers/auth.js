const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { writeAuditLog } = require('../middleware/audit');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.isActive || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = signToken(user._id);

    await writeAuditLog({
      userId: user._id, userName: user.name, userRole: user.role,
      action: 'LOGIN', entityType: 'User', entityId: user._id,
      summary: `${user.email} logged in`, req, severity: 'INFO',
    });

    res.json({ success: true, token, user: user.toSafeObject() });
  } catch (err) { next(err); }
};

// POST /api/auth/logout
const logout = async (req, res, next) => {
  try {
    await writeAuditLog({
      userId: req.user._id, userName: req.user.name, userRole: req.user.role,
      action: 'LOGOUT', entityType: 'User', entityId: req.user._id,
      summary: `${req.user.email} logged out`, req, severity: 'INFO',
    });
    res.json({ success: true, message: 'Logged out' });
  } catch (err) { next(err); }
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ success: true, data: req.user.toSafeObject ? req.user.toSafeObject() : req.user });
};

// PATCH /api/auth/change-password
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password incorrect' });
    }
    user.passwordHash = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password changed' });
  } catch (err) { next(err); }
};

module.exports = { login, logout, getMe, changePassword };
