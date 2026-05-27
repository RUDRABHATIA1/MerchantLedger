const mongoose = require('mongoose');
const ManufacturingRecipe = require('../models/ManufacturingRecipe');
const ManufacturingExpense = require('../models/ManufacturingExpense');
const ManufacturingRun = require('../models/ManufacturingRun');
const Transaction = require('../models/Transaction');

// Helper: compute totals from run data
const computeTotals = (data) => {
  const totalRawMaterialCost = (data.inputs || []).reduce(
    (s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.buyingPrice) || 0), 0
  );
  const totalOverheadCost = (data.overheads || []).reduce(
    (s, o) => s + (parseFloat(o.cost) || 0), 0
  );
  const totalProcessCost = totalRawMaterialCost + totalOverheadCost;
  return { totalRawMaterialCost, totalOverheadCost, totalProcessCost };
};

// RECIPES
const listRecipes = async (req, res, next) => {
  try {
    const data = await ManufacturingRecipe.find().sort({ createdAt: -1 });
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const createRecipe = async (req, res, next) => {
  try {
    const r = await ManufacturingRecipe.create(req.body);
    res.status(201).json({ success: true, data: r });
  } catch (err) { next(err); }
};

const updateRecipe = async (req, res, next) => {
  try {
    const r = await ManufacturingRecipe.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: r });
  } catch (err) { next(err); }
};

const deleteRecipe = async (req, res, next) => {
  try { await ManufacturingRecipe.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (err) { next(err); }
};

// MANUAL RUNS (invoked by frontend)
const createRun = async (req, res, next) => {
  try {
    const { recipeId, recipeName, combinedQuantity, notes } = req.body;
    if ((!recipeId && !recipeName) || !combinedQuantity) return res.status(422).json({ success: false, message: 'recipeId/recipeName and combinedQuantity required' });
    const manufacturingService = require('../services/manufacturingService');

    // Resolve recipe id: accept either ObjectId or recipe name (case-insensitive)
    let resolvedId = null;
    if (recipeId && mongoose.Types.ObjectId.isValid(recipeId)) resolvedId = recipeId;
    else if (recipeName) {
      const r = await ManufacturingRecipe.findOne({ name: { $regex: new RegExp('^' + recipeName + '$', 'i') } });
      if (r) resolvedId = r._id;
      else return res.status(404).json({ success: false, message: 'Recipe not found' });
    }

    const txn = await manufacturingService.createManualRun(resolvedId, parseFloat(combinedQuantity), req.user, notes);
    res.status(201).json({ success: true, data: txn });
  } catch (err) { next(err); }
};

const listRuns = async (req, res, next) => {
  try {
    const txns = await Transaction.find({ type: 'MANUFACTURING', 'metadata.processType': { $in: ['MANUAL_RUN','MANUFACTURING'] } }).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, data: txns });
  } catch (err) { next(err); }
};

// CRUD for manufacturing run records
const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, from, to } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (from || to) {
      filter.runDate = {};
      if (from) filter.runDate.$gte = new Date(from);
      if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); filter.runDate.$lte = end; }
    }
    const [data, total] = await Promise.all([
      ManufacturingRun.find(filter).populate('createdBy', 'name').sort({ runDate: -1, createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit),
      ManufacturingRun.countDocuments(filter),
    ]);
    res.json({ success: true, data, total, page: +page, pages: Math.ceil(total / +limit) });
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try { const run = await ManufacturingRun.findById(req.params.id).populate('createdBy', 'name email'); if (!run) return res.status(404).json({ success: false, message: 'Run not found' }); res.json({ success: true, data: run }); } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { processName, runDate, status, inputs, overheads, outputs, notes } = req.body;
    if (!processName) return res.status(422).json({ success: false, message: 'processName is required' });
    if (!inputs || inputs.length === 0) return res.status(422).json({ success: false, message: 'At least one input (raw material) is required' });
    if (!outputs || outputs.length === 0) return res.status(422).json({ success: false, message: 'At least one output (finished good) is required' });

    const run = new ManufacturingRun({ processName, runDate: runDate ? new Date(runDate) : new Date(), status: status || 'COMPLETED', inputs, overheads: overheads || [], outputs, notes, createdBy: req.user?._id });
    await run.save();

    if (run.status === 'COMPLETED') {
      const { nanoid } = require('nanoid');
      const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const ref = `MFG-${d}-${nanoid(5).toUpperCase()}`;

      const itemsForLedger = [];
      run.inputs.forEach(i => itemsForLedger.push({ item: i.name, quantity: i.quantity, eachCost: i.buyingPrice, direction: 'CONSUMED' }));

      let totalYield = run.outputs.reduce((s, o) => s + (o.yieldQty || 0), 0);
      run.outputs.forEach(o => {
        const costShare = totalYield > 0 ? (o.yieldQty / totalYield) : 0;
        const allocatedCost = run.totalProcessCost * costShare;
        const eachCost = o.yieldQty > 0 ? (allocatedCost / o.yieldQty) : 0;
        itemsForLedger.push({ item: o.name, quantity: o.yieldQty, eachCost, direction: 'PRODUCED' });
      });

      const txn = new Transaction({ reference: ref, type: 'TRANSFER', status: 'POSTED', description: `Manufacturing Run: ${run.processName}`, totalAmount: run.totalProcessCost, metadata: { items: itemsForLedger, manufacturingRunId: run._id, shopkeeperTxnType: 'MANUFACTURING' }, createdBy: req.user?._id, postedAt: new Date() });
      await txn.save();
      run.ledgerTransactionId = txn._id;
      await run.save();
    }

    res.status(201).json({ success: true, data: run });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const run = await ManufacturingRun.findById(req.params.id);
    if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
    if (run.status === 'COMPLETED' && run.ledgerTransactionId) return res.status(403).json({ success: false, message: 'Cannot edit a completed run that has updated the Godown. Delete it instead.' });
    const { processName, runDate, status, inputs, overheads, outputs, notes } = req.body;
    if (processName !== undefined) run.processName = processName;
    if (runDate !== undefined) run.runDate = new Date(runDate);
    if (status !== undefined) run.status = status;
    if (inputs !== undefined) run.inputs = inputs;
    if (overheads !== undefined) run.overheads = overheads;
    if (outputs !== undefined) run.outputs = outputs;
    if (notes !== undefined) run.notes = notes;
    await run.save(); res.json({ success: true, data: run });
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const run = await ManufacturingRun.findById(req.params.id);
    if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
    if (run.ledgerTransactionId) await Transaction.findByIdAndDelete(run.ledgerTransactionId);
    await ManufacturingRun.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Manufacturing run deleted and godown inventory reversed' });
  } catch (err) { next(err); }
};

const preview = async (req, res, next) => { try { const totals = computeTotals(req.body); res.json({ success: true, data: totals }); } catch (err) { next(err); } };

const summary = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const match = { status: 'COMPLETED' };
    if (from || to) { match.runDate = {}; if (from) match.runDate.$gte = new Date(from); if (to) { const end = new Date(to); end.setHours(23, 59, 59, 999); match.runDate.$lte = end; } }
    const agg = await ManufacturingRun.aggregate([{ $match: match }, { $group: { _id: null, totalRuns: { $sum: 1 }, totalProcessCost: { $sum: '$totalProcessCost' } } }]);
    res.json({ success: true, data: agg[0] || { totalRuns: 0, totalProcessCost: 0 } });
  } catch (err) { next(err); }
};

// EXPENSES
const listExpenses = async (req, res, next) => { try { const expenses = await ManufacturingExpense.find().sort({ expenseMonth: -1 }); res.json({ success: true, data: expenses }); } catch (err) { next(err); } };
const createExpense = async (req, res, next) => { try { const expense = new ManufacturingExpense({ ...req.body, createdBy: req.user?._id }); await expense.save(); res.status(201).json({ success: true, data: expense }); } catch (err) { next(err); } };
const deleteExpense = async (req, res, next) => { try { await ManufacturingExpense.findByIdAndDelete(req.params.id); res.json({ success: true }); } catch (err) { next(err); } };

module.exports = { listRecipes, createRecipe, updateRecipe, deleteRecipe, createRun, listRuns, list, getOne, create, update, remove, preview, summary, listExpenses, createExpense, deleteExpense };
