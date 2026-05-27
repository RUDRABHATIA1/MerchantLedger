const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('ADMIN', 'AUDITOR'));

router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 30, userId, action, severity, entityType, from, to } = req.query;
    const filter = {};
    if (userId)     filter.userId     = userId;
    if (action)     filter.action     = { $regex: action, $options: 'i' };
    if (severity)   filter.severity   = severity;
    if (entityType) filter.entityType = entityType;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to + 'T23:59:59Z');
    }
    const [data, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(+limit),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ success: true, data, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

module.exports = router;
