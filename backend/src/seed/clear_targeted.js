require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/paymentledger';

// Models we will touch (require safely — some may be removed)
let Recipe, ManufacturingRun, ManufacturingExpense, Transaction, Entry, AuditLog;
try { Recipe = require('../models/Recipe'); } catch (_) { Recipe = null; }
try { ManufacturingRun = require('../models/ManufacturingRun'); } catch (_) { ManufacturingRun = null; }
try { ManufacturingExpense = require('../models/ManufacturingExpense'); } catch (_) { ManufacturingExpense = null; }
try { Transaction = require('../models/Transaction'); } catch (_) { Transaction = null; }
try { Entry = require('../models/Entry'); } catch (_) { Entry = null; }
try { AuditLog = require('../models/AuditLog'); } catch (_) { AuditLog = null; }

async function clearTargeted() {
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB');

  // 1. Recipes
  if (Recipe) {
    const rRes = await Recipe.deleteMany({});
    console.log(`🗑️   Deleted ${rRes.deletedCount} recipe(s)`);
  } else {
    console.log('ℹ️   No Recipe model found — skipping recipes');
  }

  // 2. Manufacturing Runs (collect ids and linked ledger txns)
  const runIds = [];
  const linkedTxnIds = [];
  if (ManufacturingRun) {
    const runs = await ManufacturingRun.find({}, '_id ledgerTransactionId').lean();
    runs.forEach(r => { if (r._id) runIds.push(r._id); if (r.ledgerTransactionId) linkedTxnIds.push(r.ledgerTransactionId); });
    const mrRes = runIds.length ? await ManufacturingRun.deleteMany({ _id: { $in: runIds } }) : { deletedCount: 0 };
    console.log(`🗑️   Deleted ${mrRes.deletedCount} manufacturing run(s)`);
  } else {
    console.log('ℹ️   No ManufacturingRun model found — skipping runs');
  }

  // 3. Manufacturing Expenses
  let meRes = { deletedCount: 0 };
  if (ManufacturingExpense) {
    meRes = await ManufacturingExpense.deleteMany({});
    console.log(`🗑️   Deleted ${meRes.deletedCount || 0} manufacturing expense(s)`);
  } else {
    console.log('ℹ️   No ManufacturingExpense model found — skipping expenses');
  }

  // 4. Transactions related to manufacturing
  const txnFilter = {
    $or: [
      { 'metadata.manufacturingRunId': { $in: runIds } },
      { 'metadata.shopkeeperTxnType': 'MANUFACTURING' },
      { reference: { $regex: '^MFG', $options: '' } },
      { description: { $regex: 'Manufactur', $options: 'i' } }
    ]
  };

  let txnIds = [];
  if (Transaction) {
    const txns = await Transaction.find(txnFilter).lean();
    txnIds = txns.map(t => t._id);
    const txnDel = txnIds.length ? await Transaction.deleteMany({ _id: { $in: txnIds } }) : { deletedCount: 0 };
    console.log(`🗑️   Deleted ${txnDel.deletedCount} manufacturing-related transaction(s)`);
  } else {
    console.log('ℹ️   No Transaction model found — skipping transaction cleanup');
  }

  // Also remove any ledger transactions linked from runs (if they weren't captured above)
  const extraLinked = linkedTxnIds.filter(id => id && !txnIds.find(tid => tid && tid.toString() === id.toString()));
  if (extraLinked.length) {
    const extra = await Transaction.deleteMany({ _id: { $in: extraLinked } });
    console.log(`🗑️   Deleted ${extra.deletedCount} extra linked transaction(s)`);
  }

  // 5. Ledger entries for deleted transactions
  if (Entry && txnIds.length) {
    const entryDel = await Entry.deleteMany({ transactionId: { $in: txnIds } });
    console.log(`🗑️   Deleted ${entryDel.deletedCount} ledger entrie(s) for those transactions`);
  } else {
    console.log('ℹ️   No Entry model found or no related txns — skipping entry cleanup');
  }

  // 6. Audit logs referencing manufacturing runs or manufacturing keywords
  if (AuditLog) {
    const auditFilter = {
      $or: [
        { entityType: 'ManufacturingRun' },
        { entityId: { $in: runIds } },
        { 'metadata.manufacturingRunId': { $in: runIds } },
        { summary: { $regex: 'Manufactur', $options: 'i' } }
      ]
    };
    const auditDel = await AuditLog.deleteMany(auditFilter);
    console.log(`🗑️   Deleted ${auditDel.deletedCount} audit log(s) related to manufacturing`);
  } else {
    console.log('ℹ️   No AuditLog model found — skipping audit log cleanup');
  }

  console.log('\n🎉  Targeted cleanup completed.\n');
  await mongoose.disconnect();
  process.exit(0);
}

clearTargeted().catch(err => {
  console.error('❌  Targeted clear failed:', err);
  process.exit(1);
});
