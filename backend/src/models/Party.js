const mongoose = require('mongoose');

const partySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['INDIVIDUAL', 'CORPORATE'], default: 'INDIVIDUAL' },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: {
      street: String,
      city: String,
      country: { type: String, default: 'US' },
      postalCode: String,
    },
    kycStatus: { type: String, enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING' },
    kycVerifiedAt: { type: Date },
    isActive: { type: Boolean, default: true },
    notes: { type: String },
  },
  { timestamps: true }
);

partySchema.index({ name: 'text', email: 'text' });

module.exports = mongoose.model('Party', partySchema);
