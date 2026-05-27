const AuditLog = require('../models/AuditLog');

/**
 * Append-only audit log writer — never throws (fire-and-forget with logging)
 */
const writeAuditLog = async ({ userId, userName, userRole, action, entityType, entityId, summary, metadata, req, severity = 'INFO' }) => {
  try {
    await AuditLog.create({
      userId,
      userName,
      userRole,
      action,
      entityType,
      entityId,
      summary,
      metadata,
      ip: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers?.['user-agent'],
      severity,
    });
  } catch (err) {
    console.error('[AuditLog] Failed to write audit log:', err.message);
  }
};

module.exports = { writeAuditLog };
