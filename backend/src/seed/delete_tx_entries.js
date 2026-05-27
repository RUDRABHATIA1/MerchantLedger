require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/paymentledger';

const Transaction = require('../models/Transaction');
const Entry = require('../models/Entry');

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB');

  const txnCount = await Transaction.countDocuments();
  const entryCount = await Entry.countDocuments();
  console.log(`ℹ️   Current counts — Transactions: ${txnCount}, Entries: ${entryCount}`);

  if (txnCount === 0 && entryCount === 0) {
    console.log('ℹ️   Nothing to delete.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const txnRes = await Transaction.deleteMany({});
  const entryRes = await Entry.deleteMany({});

  console.log(`🗑️   Deleted ${txnRes.deletedCount} transaction(s)`);
  console.log(`🗑️   Deleted ${entryRes.deletedCount} entry(ies)`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌  Delete failed:', err);
  process.exit(1);
});
