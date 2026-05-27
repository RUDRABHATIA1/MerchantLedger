const mongoose = require('mongoose');

const ManufacturingRunSchema = new mongoose.Schema({
  processName: { type: String, required: true },
  runDate: { type: Date, default: Date.now },
  status: { type: String, default: 'COMPLETED' },
  inputs: [{ name: String, quantity: Number, buyingPrice: Number }],
  overheads: [{ name: String, cost: Number }],
  outputs: [{ name: String, yieldQty: Number }],
  totalProcessCost: { type: Number, default: 0 },
  ledgerTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ManufacturingRun', ManufacturingRunSchema);
