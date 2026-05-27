require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
const User = require('../models/User');
const Party = require('../models/Party');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Entry = require('../models/Entry');
const AuditLog = require('../models/AuditLog');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/paymentledger';

const rand = (min, max) => Math.round((Math.random() * (max - min) + min) * 100) / 100;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('✅  Connected to MongoDB');

  // Clear all collections
  await Promise.all([
    User.deleteMany({}), Party.deleteMany({}), Account.deleteMany({}),
    Transaction.deleteMany({}), Entry.deleteMany({}), AuditLog.deleteMany({}),
  ]);
  console.log('🗑️   Cleared existing data');

  // ── 1. Users ─────────────────────────────────────────────────────────────
  const [admin, teller, auditor] = await User.create([
    { name: 'Admin User',    email: 'admin@ledger.dev',   passwordHash: 'Admin@1234',  role: 'ADMIN' },
    { name: 'Sarah Teller',  email: 'teller@ledger.dev',  passwordHash: 'Teller@1234', role: 'TELLER' },
    { name: 'Alex Auditor',  email: 'auditor@ledger.dev', passwordHash: 'Audit@1234',  role: 'AUDITOR' },
  ]);
  console.log('👥  Users created');

  // ── 2. System GL Accounts ─────────────────────────────────────────────────
  const genAccNum = (prefix) => `${prefix}-${nanoid(8).toUpperCase()}`;
  const [bankCash, feeIncome, chargebackExp, suspenseAcc] = await Account.create([
    {
      accountNumber: genAccNum('GL-CASH'), name: 'Bank Settlement Account',
      type: 'ASSET', subtype: 'SETTLEMENT', currency: 'USD',
      currentBalance: 500000, availableBalance: 500000,
      isSystemAccount: true, description: 'Main bank settlement/cash GL account',
    },
    {
      accountNumber: genAccNum('GL-FEE'), name: 'Fee Income Account',
      type: 'INCOME', subtype: 'FEE_INCOME', currency: 'USD',
      currentBalance: 0, availableBalance: 0,
      isSystemAccount: true, description: 'Revenue account for all service fees',
    },
    {
      accountNumber: genAccNum('GL-CHBK'), name: 'Chargeback Expense Account',
      type: 'EXPENSE', subtype: 'CHARGEBACK', currency: 'USD',
      currentBalance: 0, availableBalance: 0,
      isSystemAccount: true, description: 'Expense account for chargebacks and refunds',
    },
    {
      accountNumber: genAccNum('GL-SUSP'), name: 'Suspense Account',
      type: 'LIABILITY', subtype: 'GENERAL', currency: 'USD',
      currentBalance: 0, availableBalance: 0,
      isSystemAccount: true, description: 'Suspense account for pending reconciliation',
    },
  ]);
  console.log('🏦  GL accounts created');

  // ── 3. Parties (Customers) ────────────────────────────────────────────────
  const partyData = [
    { name: 'Aiden Patel',       type: 'INDIVIDUAL', email: 'aiden@example.com',    phone: '+1-555-0101', kycStatus: 'VERIFIED' },
    { name: 'Maria González',    type: 'INDIVIDUAL', email: 'maria@example.com',    phone: '+1-555-0102', kycStatus: 'VERIFIED' },
    { name: 'James Okafor',      type: 'INDIVIDUAL', email: 'james@example.com',    phone: '+1-555-0103', kycStatus: 'VERIFIED' },
    { name: 'Priya Sharma',      type: 'INDIVIDUAL', email: 'priya@example.com',    phone: '+1-555-0104', kycStatus: 'VERIFIED' },
    { name: 'Lucas Chen',        type: 'INDIVIDUAL', email: 'lucas@example.com',    phone: '+1-555-0105', kycStatus: 'VERIFIED' },
    { name: 'Fatima Al-Hassan',  type: 'INDIVIDUAL', email: 'fatima@example.com',   phone: '+1-555-0106', kycStatus: 'PENDING'  },
    { name: 'Noah Williams',     type: 'INDIVIDUAL', email: 'noah@example.com',     phone: '+1-555-0107', kycStatus: 'VERIFIED' },
    { name: 'Zara Thompson',     type: 'INDIVIDUAL', email: 'zara@example.com',     phone: '+1-555-0108', kycStatus: 'REJECTED' },
    { name: 'Apex Fintech Ltd',  type: 'CORPORATE',  email: 'ops@apexfintech.com',  phone: '+1-555-0200', kycStatus: 'VERIFIED' },
    { name: 'Quantum Payments',  type: 'CORPORATE',  email: 'billing@qpay.io',      phone: '+1-555-0201', kycStatus: 'VERIFIED' },
    { name: 'NovaMerchants Inc', type: 'CORPORATE',  email: 'finance@novamerch.com',phone: '+1-555-0202', kycStatus: 'VERIFIED' },
  ];
  const parties = await Party.create(partyData);
  console.log(`👤  ${parties.length} parties created`);

  // ── 4. Customer Accounts ──────────────────────────────────────────────────
  const subtypes = ['CUSTOMER_WALLET', 'SAVINGS', 'MERCHANT'];
  const customerAccounts = await Account.create(
    parties.map((p, i) => ({
      accountNumber: genAccNum('ACC'),
      partyId: p._id,
      name: `${p.name} — ${subtypes[i % 3]}`,
      type: 'LIABILITY',
      subtype: subtypes[i % 3],
      currency: 'USD',
      currentBalance: 0,
      availableBalance: 0,
      status: p.kycStatus === 'REJECTED' ? 'FROZEN' : 'ACTIVE',
      isSystemAccount: false,
    }))
  );
  console.log(`💳  ${customerAccounts.length} customer accounts created`);

  // ── 5. Seed Transactions ──────────────────────────────────────────────────
  // We manually post without sessions for seeding (not production — seed is offline)
  const activeAccounts = customerAccounts.filter(a => a.status === 'ACTIVE');

  const txns = [];
  const allEntries = [];

  // Utility: create a transaction + entries directly (no session, for speed)
  const createTxn = async ({ type, description, amount, entries, createdAt, user = admin }) => {
    const date = new Date(createdAt);
    const ref = `TXN-${date.toISOString().slice(0,10).replace(/-/g,'')}${nanoid(6).toUpperCase()}`;
    const txn = await Transaction.create({
      reference: ref, type, status: 'POSTED', description, currency: 'USD',
      totalAmount: amount, postedAt: date, createdBy: user._id,
      createdAt: date, updatedAt: date,
    });
    const entryDocs = entries.map(e => ({
      transactionId: txn._id, accountId: e.accountId, direction: e.direction,
      amount: e.amount, currency: 'USD', state: 'POSTED', isImmutable: true,
      createdAt: date, updatedAt: date,
    }));
    await Entry.insertMany(entryDocs);
    // Update balances
    for (const e of entries) {
      const delta = e.direction === 'CREDIT' ? e.amount : -e.amount;
      await Account.findByIdAndUpdate(e.accountId, { $inc: { currentBalance: delta, availableBalance: delta } });
    }
    return txn;
  };

  // --- Deposits for all active accounts (last 30 days)
  for (let i = 0; i < activeAccounts.length; i++) {
    const acc = activeAccounts[i];
    const depositAmt = rand(1000, 20000);
    await createTxn({
      type: 'DEPOSIT', description: `Initial deposit — ${acc.name}`,
      amount: depositAmt,
      entries: [
        { accountId: bankCash._id, direction: 'DEBIT',  amount: depositAmt },
        { accountId: acc._id,      direction: 'CREDIT', amount: depositAmt },
      ],
      createdAt: daysAgo(rand(25, 30)),
    });

    // Additional top-up
    const topup = rand(200, 5000);
    await createTxn({
      type: 'DEPOSIT', description: 'Top-up',
      amount: topup,
      entries: [
        { accountId: bankCash._id, direction: 'DEBIT',  amount: topup },
        { accountId: acc._id,      direction: 'CREDIT', amount: topup },
      ],
      createdAt: daysAgo(rand(10, 24)),
    });
  }

  // --- Transfers between accounts
  const pairs = [
    [0,1],[1,2],[2,3],[3,4],[4,5],[0,6],[1,7],[5,6],[7,8],[8,9]
  ];
  for (const [fi, ti] of pairs) {
    if (!activeAccounts[fi] || !activeAccounts[ti]) continue;
    const from = activeAccounts[fi], to = activeAccounts[ti];
    const amount = rand(100, 2000);
    const fee = rand(1, 15);
    await createTxn({
      type: 'TRANSFER', description: `Transfer ${from.accountNumber} → ${to.accountNumber}`,
      amount,
      entries: [
        { accountId: from._id,      direction: 'DEBIT',  amount: amount + fee },
        { accountId: to._id,        direction: 'CREDIT', amount },
        { accountId: feeIncome._id, direction: 'CREDIT', amount: fee },
      ],
      createdAt: daysAgo(rand(1, 15)),
      user: teller,
    });
  }

  // --- Withdrawals
  for (let i = 0; i < Math.min(5, activeAccounts.length); i++) {
    const acc = activeAccounts[i];
    const refreshed = await Account.findById(acc._id);
    const wdAmt = Math.min(rand(50, 500), refreshed.availableBalance * 0.3);
    if (wdAmt < 1) continue;
    await createTxn({
      type: 'WITHDRAWAL', description: 'ATM withdrawal',
      amount: wdAmt,
      entries: [
        { accountId: acc._id,     direction: 'DEBIT',  amount: wdAmt },
        { accountId: bankCash._id, direction: 'CREDIT', amount: wdAmt },
      ],
      createdAt: daysAgo(rand(1, 10)),
    });
  }

  // --- Fees
  for (let i = 0; i < Math.min(6, activeAccounts.length); i++) {
    const feeAmt = rand(2, 25);
    await createTxn({
      type: 'FEE', description: 'Monthly maintenance fee',
      amount: feeAmt,
      entries: [
        { accountId: activeAccounts[i]._id, direction: 'DEBIT',  amount: feeAmt },
        { accountId: feeIncome._id,          direction: 'CREDIT', amount: feeAmt },
      ],
      createdAt: daysAgo(rand(1, 5)),
    });
  }

  // --- Refund
  const refundAmt = rand(10, 50);
  await createTxn({
    type: 'REFUND', description: 'Service fee refund — customer dispute resolved',
    amount: refundAmt,
    entries: [
      { accountId: feeIncome._id,         direction: 'DEBIT',  amount: refundAmt },
      { accountId: activeAccounts[0]._id, direction: 'CREDIT', amount: refundAmt },
    ],
    createdAt: daysAgo(1),
    user: admin,
  });

  // --- 1 Pending transaction
  const pendingAmt = rand(500, 2000);
  await Transaction.create({
    reference: `TXN-PENDING-${nanoid(6).toUpperCase()}`,
    type: 'DEPOSIT', status: 'PENDING',
    description: 'Pending wire deposit (awaiting bank confirmation)',
    currency: 'USD', totalAmount: pendingAmt,
    createdBy: teller._id,
  });

  const txnCount = await Transaction.countDocuments();
  const entryCount = await Entry.countDocuments();
  console.log(`📒  ${txnCount} transactions | ${entryCount} entries created`);

  // ── 6. Audit Logs ─────────────────────────────────────────────────────────
  await AuditLog.insertMany([
    { userId: admin._id, userName: admin.name, userRole: 'ADMIN', action: 'LOGIN', entityType: 'User', entityId: admin._id, summary: 'Admin logged in', severity: 'INFO', ip: '192.168.1.1', createdAt: daysAgo(2) },
    { userId: teller._id, userName: teller.name, userRole: 'TELLER', action: 'POST_DEPOSIT', entityType: 'Transaction', summary: 'Posted deposit', severity: 'INFO', ip: '192.168.1.5', createdAt: daysAgo(1) },
    { userId: admin._id, userName: admin.name, userRole: 'ADMIN', action: 'ACCOUNT_FROZEN', entityType: 'Account', summary: 'Froze account due to suspicious activity', severity: 'WARN', ip: '192.168.1.1', createdAt: daysAgo(3) },
    { userId: auditor._id, userName: auditor.name, userRole: 'AUDITOR', action: 'LOGIN', entityType: 'User', entityId: auditor._id, summary: 'Auditor logged in for monthly review', severity: 'INFO', ip: '10.0.0.2', createdAt: daysAgo(0) },
  ]);
  console.log('📋  Audit logs created');

  console.log('\n🎉  Seed complete!\n');
  console.log('🔑  Login credentials:');
  console.log('    admin@ledger.dev   / Admin@1234   (ADMIN)');
  console.log('    teller@ledger.dev  / Teller@1234  (TELLER)');
  console.log('    auditor@ledger.dev / Audit@1234   (AUDITOR)\n');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
