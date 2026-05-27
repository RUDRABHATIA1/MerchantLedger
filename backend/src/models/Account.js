const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    accountNumber: { type: String, required: true, unique: true },
    partyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Party', default: null },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY'],
      required: true,
    },
    subtype: {
      type: String,
      enum: ['CUSTOMER_WALLET', 'SAVINGS', 'MERCHANT', 'SETTLEMENT', 'FEE_INCOME', 'CHARGEBACK', 'GENERAL'],
      default: 'GENERAL',
    },
    status: { type: String, enum: ['ACTIVE', 'FROZEN', 'CLOSED'], default: 'ACTIVE' },
    currency: { type: String, default: 'USD', uppercase: true },
    currentBalance: { type: Number, default: 0 },   // all posted entries
    availableBalance: { type: Number, default: 0 },  // excludes pending debits
    isSystemAccount: { type: Boolean, default: false },
    description: { type: String },
    frozenReason: { type: String },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

accountSchema.index({ partyId: 1 });
accountSchema.index({ type: 1, subtype: 1 });
accountSchema.index({ status: 1 });

module.exports = mongoose.model('Account', accountSchema);
