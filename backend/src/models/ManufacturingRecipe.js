const mongoose = require('mongoose');

const InputSchema = new mongoose.Schema({
  name: { type: String, required: true },
  percent: { type: Number, required: true },
});

const OutputSchema = new mongoose.Schema({
  name: { type: String, required: true },
  yieldPer100: { type: Number, required: true },
});

const ManufacturingRecipeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  inputs: [InputSchema],
  outputs: [OutputSchema],
  enabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ManufacturingRecipe', ManufacturingRecipeSchema);
