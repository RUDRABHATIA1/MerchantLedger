const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema(
  {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      required: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    direction: { type: String, enum: ['DEBIT', 'CREDIT'], required: true },
    amount: { type: Number, required: true, min: 0.0001 },
    currency: { type: String, default: 'USD' },
    state: { type: String, enum: ['PENDING', 'POSTED', 'REVERSED'], default: 'PENDING' },
    description: { type: String },
    // Prevent updates once posted — enforced in service layer + this flag
    isImmutable: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Immutability guard — reject updates to posted entries
entrySchema.pre('findOneAndUpdate', async function (next) {
  const entry = await this.model.findOne(this.getQuery());
  if (entry && entry.isImmutable) {
    const err = new Error('Cannot modify a posted ledger entry');
    err.statusCode = 403;
    return next(err);
  }
  next();
});

entrySchema.index({ transactionId: 1 });
entrySchema.index({ accountId: 1, state: 1 });
entrySchema.index({ accountId: 1, createdAt: -1 });

module.exports = mongoose.model('Entry', entrySchema);
