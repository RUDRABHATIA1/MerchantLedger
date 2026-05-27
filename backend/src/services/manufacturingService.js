const Transaction = require('../models/Transaction');
const ManufacturingRecipe = require('../models/ManufacturingRecipe');
const ManufacturingExpense = require('../models/ManufacturingExpense');

const normalize = (value) => (value || '').trim().toLowerCase();

const resolveItemDirection = (txn, item) => {
  if (item.direction) return String(item.direction).toUpperCase();
  const shopkeeperType = String(txn.metadata?.shopkeeperTxnType || '').toUpperCase();
  if (shopkeeperType === 'BUY_SOLD') return String(txn.metadata?.direction || 'SOLD').toUpperCase();
  if (shopkeeperType === 'CREDIT_SALE') return 'SOLD';
  if (shopkeeperType === 'MANUFACTURING') return String(txn.metadata?.processType || 'SOLD').toUpperCase();
  return String(txn.metadata?.direction || 'SOLD').toUpperCase();
};

const getInventorySnapshot = async () => {
  const txns = await Transaction.find({
    status: 'POSTED',
    'metadata.items': { $exists: true },
  })
    .select('metadata.items metadata.direction metadata.shopkeeperTxnType metadata.processType createdAt')
    .sort({ createdAt: 1, _id: 1 });

  const stock = new Map();

  for (const txn of txns) {
    const items = txn.metadata?.items || [];
    for (const item of items) {
      const name = normalize(item.item);
      const quantity = parseFloat(item.quantity) || 0;
      const unitCost = parseFloat(item.eachCost) || 0;
      if (!name || quantity <= 0) continue;

      const direction = resolveItemDirection(txn, item);
      const current = stock.get(name) || { name: item.item.trim(), qty: 0, value: 0 };

      if (direction === 'BUY' || direction === 'PRODUCED' || direction === 'CREDIT') {
        current.qty += quantity;
        current.value += quantity * unitCost;
      } else if (direction === 'SOLD' || direction === 'CONSUMED' || direction === 'DEBIT') {
        const avgCost = current.qty > 0 ? current.value / current.qty : 0;
        const consumeQty = Math.min(current.qty, quantity);
        current.qty -= consumeQty;
        current.value = Math.max(0, current.value - (consumeQty * avgCost));
      }

      stock.set(name, current);
    }
  }

  return stock;
};

const sumProducedThisMonth = async (outputNames, month) => {
  const txns = await Transaction.find({ status: 'POSTED', 'metadata.items': { $exists: true } }).select('metadata.items createdAt');
  let total = 0;
  txns.forEach((t) => {
    const items = t.metadata.items || [];
    items.forEach((i) => {
      if (i.direction === 'PRODUCED' && outputNames.includes(normalize(i.item))) {
        total += parseFloat(i.quantity) || 0;
      }
    });
  });
  return total;
};

const getRecipeRunCount = (recipe, stock) => {
  if (!recipe.inputs?.length) return 0;
  let maxRuns = Infinity;
  for (const input of recipe.inputs) {
    const requiredQty = parseFloat(input.percent) || 0;
    if (requiredQty <= 0) return 0;
    const availableQty = stock.get(normalize(input.name))?.qty || 0;
    maxRuns = Math.min(maxRuns, Math.floor(availableQty / requiredQty));
  }
  return Number.isFinite(maxRuns) ? maxRuns : 0;
};

const createManufacturingTxn = async ({ recipe, runCount, stock, user, processType, notes }) => {
  if (!runCount || runCount <= 0) return null;

  const month = new Date().toISOString().slice(0, 7);
  const expenses = await ManufacturingExpense.find({ expenseMonth: month });
  const expenseSum = expenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);

  const inputItems = [];
  let totalInputCost = 0;

  recipe.inputs.forEach((input) => {
    const quantity = (parseFloat(input.percent) || 0) * runCount;
    if (quantity <= 0) return;

    const current = stock.get(normalize(input.name));
    const unitCost = current && current.qty > 0 ? current.value / current.qty : 0;
    totalInputCost += quantity * unitCost;
    inputItems.push({ item: input.name, quantity, eachCost: unitCost, direction: 'CONSUMED' });
  });

  const outputItems = [];
  const totalOutputQty = recipe.outputs.reduce((sum, output) => sum + ((parseFloat(output.yieldPer100) || 0) * runCount), 0);
  if (totalOutputQty <= 0) return null;

  const outputNames = recipe.outputs.map((output) => normalize(output.name));
  const producedThisMonth = await sumProducedThisMonth(outputNames, month);
  const expensePerUnit = (producedThisMonth + totalOutputQty) > 0 ? (expenseSum / (producedThisMonth + totalOutputQty)) : 0;
  const allocatedExpense = expensePerUnit * totalOutputQty;
  const unitProductionCost = (totalInputCost + allocatedExpense) / totalOutputQty;

  recipe.outputs.forEach((output) => {
    const quantity = (parseFloat(output.yieldPer100) || 0) * runCount;
    if (quantity <= 0) return;
    outputItems.push({ item: output.name, quantity, eachCost: unitProductionCost, direction: 'PRODUCED' });
  });

  const metadataItems = [...inputItems, ...outputItems];
  if (!metadataItems.length) return null;

  return Transaction.create({
    type: 'MANUFACTURING',
    description: `${processType === 'MANUAL_RUN' ? 'Manual production run' : 'Auto production'}: ${recipe.name}` + (notes ? ` - ${notes}` : '') + ` x${runCount}`,
    totalAmount: totalInputCost + allocatedExpense,
    status: 'POSTED',
    metadata: {
      items: metadataItems,
      processType,
      recipeId: recipe._id,
      recipeName: recipe.name,
      runCount,
    },
    createdBy: user ? user._id : undefined,
  });
};

const applyTxnToStock = (recipe, runCount, stock) => {
  recipe.inputs.forEach((input) => {
    const quantity = (parseFloat(input.percent) || 0) * runCount;
    if (quantity <= 0) return;
    const key = normalize(input.name);
    const current = stock.get(key) || { name: input.name.trim(), qty: 0, value: 0 };
    const unitCost = current.qty > 0 ? current.value / current.qty : 0;
    const consumeQty = Math.min(current.qty, quantity);
    current.qty -= consumeQty;
    current.value = Math.max(0, current.value - (consumeQty * unitCost));
    stock.set(key, current);
  });

  recipe.outputs.forEach((output) => {
    const quantity = (parseFloat(output.yieldPer100) || 0) * runCount;
    if (quantity <= 0) return;
    const key = normalize(output.name);
    const current = stock.get(key) || { name: output.name.trim(), qty: 0, value: 0 };
    const tx = stock.get('__last_tx_cost__') || { unitCost: 0 };
    const unitCost = tx.unitCost || 0;
    current.qty += quantity;
    current.value += quantity * unitCost;
    stock.set(key, current);
  });
};

const rebalanceManufacturing = async (user) => {
  let producedAny = false;

  for (let iteration = 0; iteration < 10; iteration += 1) {
    const stock = await getInventorySnapshot();
    const recipes = await ManufacturingRecipe.find({ enabled: true }).sort({ createdAt: 1 });
    let producedThisPass = false;

    for (const recipe of recipes) {
      const runCount = getRecipeRunCount(recipe, stock);
      if (runCount <= 0) continue;

      const txn = await createManufacturingTxn({ recipe, runCount, stock, user, processType: 'AUTO_MANUFACTURING' });
      if (txn) {
        const lastTxnCost = txn.totalAmount && txn.metadata?.items?.filter(i => i.direction === 'PRODUCED').length
          ? { unitCost: txn.totalAmount / txn.metadata.items.filter(i => i.direction === 'PRODUCED').reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0) }
          : { unitCost: 0 };
        stock.set('__last_tx_cost__', lastTxnCost);
        applyTxnToStock(recipe, runCount, stock);
      }
      producedThisPass = true;
      producedAny = true;
    }

    if (!producedThisPass) break;
  }

  return producedAny;
};

const handlePurchase = async (items, user) => {
  if (!Array.isArray(items) || !items.length) return false;
  return rebalanceManufacturing(user);
};

const handleSale = async (items, user) => {
  if (!Array.isArray(items) || !items.length) return false;
  return rebalanceManufacturing(user);
};

const createManualRun = async (recipeId, combinedQuantity, user, notes) => {
  const recipe = await ManufacturingRecipe.findById(recipeId);
  if (!recipe) throw new Error('Recipe not found');

  const requestedQty = parseFloat(combinedQuantity);
  if (!requestedQty || requestedQty <= 0) throw new Error('combinedQuantity must be greater than 0');

  const stock = await getInventorySnapshot();
  for (const input of recipe.inputs) {
    const requiredQty = ((parseFloat(input.percent) || 0) * requestedQty) / 100;
    const availableQty = stock.get(normalize(input.name))?.qty || 0;
    if (availableQty < requiredQty) {
      throw new Error(`Insufficient stock for ${input.name}`);
    }
  }

  const txn = await createManufacturingTxn({
    recipe,
    runCount: requestedQty / 100,
    stock,
    user,
    processType: 'MANUAL_RUN',
    notes,
  });

  if (!txn) throw new Error('Unable to create manual run');
  return txn;
};

module.exports = { handlePurchase, handleSale, createManualRun, rebalanceManufacturing };

