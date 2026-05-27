const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String },
    userRole: { type: String },
    action: { type: String, required: true },         // e.g. "POST_TRANSACTION", "FREEZE_ACCOUNT"
    entityType: { type: String },                     // "Transaction", "Account", "Party"
    entityId: { type: mongoose.Schema.Types.ObjectId },
    summary: { type: String },                        // human-readable one-liner
    metadata: { type: mongoose.Schema.Types.Mixed },  // full request/response snapshot
    ip: { type: String },
    userAgent: { type: String },
    severity: { type: String, enum: ['INFO', 'WARN', 'CRITICAL'], default: 'INFO' },
  },
  {
    timestamps: true,
    // Immutable collection — no updates allowed
    strict: true,
  }
);

// TTL: keep audit logs for 2 years (optional, remove for permanent logs)
// auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
