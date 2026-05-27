const mongoose = require('mongoose');

const ManufacturingExpenseSchema = new mongoose.Schema({
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  expenseMonth: { type: String, required: true }, // YYYY-MM
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ManufacturingExpense', ManufacturingExpenseSchema);
