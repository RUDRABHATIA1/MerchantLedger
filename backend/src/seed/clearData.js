require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/paymentledger';

// Inline minimal schemas (avoids importing full models with hooks)
const Transaction = require('../models/Transaction');
const Entry       = require('../models/Entry');
const Account     = require('../models/Account');

// Try to load an Item model if it exists
let Item;
try { Item = require('../models/Item'); } catch (_) { Item = null; }

async function clearData() {
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB');

  // 1. Delete all transactions
  const txnResult = await Transaction.deleteMany({});
  console.log(`🗑️   Deleted ${txnResult.deletedCount} transactions`);

  // 2. Delete all ledger entries
  const entryResult = await Entry.deleteMany({});
  console.log(`🗑️   Deleted ${entryResult.deletedCount} entries`);

  // 3. Delete all items (if the collection exists)
  if (Item) {
    const itemResult = await Item.deleteMany({});
    console.log(`🗑️   Deleted ${itemResult.deletedCount} items`);
  } else {
    console.log('ℹ️   No Item model found — skipping items');
  }

  // 4. Reset all account balances to 0
  const accResult = await Account.updateMany(
    {},
    { $set: { currentBalance: 0, availableBalance: 0 } }
  );
  console.log(`💳  Reset balances on ${accResult.modifiedCount} accounts`);

  console.log('\n🎉  Done! All transactions, entries, and items cleared.\n');
  await mongoose.disconnect();
  process.exit(0);
}

clearData().catch((err) => {
  console.error('❌  Clear failed:', err);
  process.exit(1);
});
