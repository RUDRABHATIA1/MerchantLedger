const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'FEE', 'REFUND', 'REVERSAL'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'POSTED', 'REVERSED', 'FAILED'],
      default: 'PENDING',
    },
    description: { type: String },
    currency: { type: String, default: 'USD' },
    totalAmount: { type: Number, required: true, min: 0.01 },
    idempotencyKey: { type: String },
    clientId: { type: String },
    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
    postedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Enforce idempotency: unique per (clientId, idempotencyKey) when both are present
transactionSchema.index(
  { clientId: 1, idempotencyKey: 1 },
  { unique: true, sparse: true, partialFilterExpression: { idempotencyKey: { $exists: true } } }
);
transactionSchema.index({ status: 1, type: 1 });
transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
