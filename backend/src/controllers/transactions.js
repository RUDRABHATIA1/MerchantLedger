const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Entry = require('../models/Entry');
const { postTransaction, capturePending, reverseTransaction } = require('../services/ledger');
let manufacturingService;
try { manufacturingService = require('../services/manufacturingService'); } catch (_) { manufacturingService = null; }

// ── Helper: get GL system account by subtype ──────────────────────────────
const getGLAccount = async (subtype) => {
  const acc = await Account.findOne({ isSystemAccount: true, subtype });
  if (!acc) throw Object.assign(new Error(`GL account "${subtype}" not found. Run seed first.`), { statusCode: 500 });
  return acc;
};

// ── Helper: verify account is ACTIVE ─────────────────────────────────────
const requireActive = (account) => {
  if (account.status !== 'ACTIVE') {
    throw Object.assign(new Error(`Account ${account.accountNumber} is ${account.status}`), { statusCode: 422 });
  }
};

// GET /api/transactions
const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, status, from, to } = req.query;
    const filter = {};
    if (type)   filter.type   = type;
    if (status) filter.status = status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to + 'T23:59:59Z');
    }
    const [data, total] = await Promise.all([
      Transaction.find(filter)
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(+limit),
      Transaction.countDocuments(filter),
    ]);
    res.json({ success: true, data, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// GET /api/transactions/:id (with all entries)
const getOne = async (req, res, next) => {
  try {
    const txn = await Transaction.findById(req.params.id)
      .populate('createdBy', 'name email role')
      .populate('reversalOf', 'reference type')
      .populate('reversedBy', 'reference type');
    if (!txn) return res.status(404).json({ success: false, message: 'Transaction not found' });
    const entries = await Entry.find({ transactionId: txn._id })
      .populate('accountId', 'accountNumber name type subtype currency partyId')
      .sort({ direction: 1 });
    res.json({ success: true, data: { transaction: txn, entries } });
  } catch (err) { next(err); }
};

// POST /api/transactions/deposit
const deposit = async (req, res, next) => {
  try {
    const { accountId, amount, description, postImmediately = true } = req.body;
    const [customerAcc, bankCash] = await Promise.all([
      Account.findById(accountId),
      getGLAccount('SETTLEMENT'),
    ]);
    if (!customerAcc) return res.status(404).json({ success: false, message: 'Account not found' });
    requireActive(customerAcc); requireActive(bankCash);

    const result = await postTransaction({
      type: 'DEPOSIT',
      description: description || 'Deposit',
      totalAmount: amount,
      entries: [
        { accountId: bankCash._id,    direction: 'DEBIT',  amount }, // bank gains cash
        { accountId: customerAcc._id, direction: 'CREDIT', amount }, // customer gains liability
      ],
      idempotencyKey: req.idempotencyKey,
      clientId: req.clientId,
      user: req.user, req,
      postImmediately,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

// POST /api/transactions/withdrawal
const withdrawal = async (req, res, next) => {
  try {
    const { accountId, amount, description, postImmediately = true } = req.body;
    const [customerAcc, bankCash] = await Promise.all([
      Account.findById(accountId),
      getGLAccount('SETTLEMENT'),
    ]);
    if (!customerAcc) return res.status(404).json({ success: false, message: 'Account not found' });
    requireActive(customerAcc); requireActive(bankCash);

    if (customerAcc.availableBalance < amount) {
      return res.status(422).json({ success: false, message: 'Insufficient available balance' });
    }

    const result = await postTransaction({
      type: 'WITHDRAWAL',
      description: description || 'Withdrawal',
      totalAmount: amount,
      entries: [
        { accountId: customerAcc._id, direction: 'DEBIT',  amount },
        { accountId: bankCash._id,    direction: 'CREDIT', amount },
      ],
      idempotencyKey: req.idempotencyKey,
      clientId: req.clientId,
      user: req.user, req,
      postImmediately,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

// POST /api/transactions/transfer
const transfer = async (req, res, next) => {
  try {
    const { fromAccountId, toAccountId, amount, feeAmount = 0, description } = req.body;
    if (fromAccountId === toAccountId) {
      return res.status(422).json({ success: false, message: 'Cannot transfer to same account' });
    }

    const [fromAcc, toAcc] = await Promise.all([
      Account.findById(fromAccountId),
      Account.findById(toAccountId),
    ]);
    if (!fromAcc || !toAcc) return res.status(404).json({ success: false, message: 'Account(s) not found' });
    requireActive(fromAcc); requireActive(toAcc);

    const totalDebit = amount + feeAmount;
    if (fromAcc.availableBalance < totalDebit) {
      return res.status(422).json({ success: false, message: 'Insufficient available balance' });
    }

    const entries = [
      { accountId: fromAcc._id, direction: 'DEBIT',  amount },
      { accountId: toAcc._id,   direction: 'CREDIT', amount },
    ];

    if (feeAmount > 0) {
      const feeAcc = await getGLAccount('FEE_INCOME');
      entries.push({ accountId: fromAcc._id, direction: 'DEBIT',  amount: feeAmount, description: 'Transfer fee' });
      entries.push({ accountId: feeAcc._id,  direction: 'CREDIT', amount: feeAmount, description: 'Transfer fee income' });
    }

    const result = await postTransaction({
      type: 'TRANSFER',
      description: description || `Transfer ${fromAcc.accountNumber} → ${toAcc.accountNumber}`,
      totalAmount: amount,
      entries,
      idempotencyKey: req.idempotencyKey,
      clientId: req.clientId,
      metadata: { fromAccount: fromAcc.accountNumber, toAccount: toAcc.accountNumber, feeAmount },
      user: req.user, req,
      postImmediately: true,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

// POST /api/transactions/fee
const fee = async (req, res, next) => {
  try {
    const { accountId, amount, description } = req.body;
    const [customerAcc, feeAcc] = await Promise.all([
      Account.findById(accountId),
      getGLAccount('FEE_INCOME'),
    ]);
    if (!customerAcc) return res.status(404).json({ success: false, message: 'Account not found' });
    requireActive(customerAcc);
    if (customerAcc.availableBalance < amount) {
      return res.status(422).json({ success: false, message: 'Insufficient balance for fee' });
    }
    const result = await postTransaction({
      type: 'FEE',
      description: description || 'Service fee',
      totalAmount: amount,
      entries: [
        { accountId: customerAcc._id, direction: 'DEBIT',  amount },
        { accountId: feeAcc._id,      direction: 'CREDIT', amount },
      ],
      idempotencyKey: req.idempotencyKey,
      clientId: req.clientId,
      user: req.user, req,
      postImmediately: true,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

// POST /api/transactions/refund
const refund = async (req, res, next) => {
  try {
    const { accountId, amount, description } = req.body;
    const [customerAcc, feeAcc] = await Promise.all([
      Account.findById(accountId),
      getGLAccount('FEE_INCOME'),
    ]);
    if (!customerAcc) return res.status(404).json({ success: false, message: 'Account not found' });
    requireActive(customerAcc);
    const result = await postTransaction({
      type: 'REFUND',
      description: description || 'Refund',
      totalAmount: amount,
      entries: [
        { accountId: feeAcc._id,      direction: 'DEBIT',  amount },
        { accountId: customerAcc._id, direction: 'CREDIT', amount },
      ],
      idempotencyKey: req.idempotencyKey,
      clientId: req.clientId,
      user: req.user, req,
      postImmediately: true,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

// POST /api/transactions/:id/capture
const capture = async (req, res, next) => {
  try {
    const txn = await capturePending({ transactionId: req.params.id, user: req.user, req });
    res.json({ success: true, data: txn });
  } catch (err) { next(err); }
};

// POST /api/transactions/:id/reverse
const reverse = async (req, res, next) => {
  try {
    const result = await reverseTransaction({
      transactionId: req.params.id,
      description: req.body.description,
      user: req.user, req,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

// POST /api/transactions/credit-sale (Shopkeeper: Gave Items)
const creditSale = async (req, res, next) => {
  try {
    const { partyId, amount, description, metadata } = req.body;
    let customerAcc = await Account.findOne({ partyId, status: 'ACTIVE' });
    if (!customerAcc) {
      const Party = require('../models/Party');
      const { nanoid } = require('nanoid');
      const party = await Party.findById(partyId);
      if (!party) return res.status(404).json({ success: false, message: 'Party not found' });
      
      const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const accNum = `ACC-${d}-${nanoid(5).toUpperCase()}`;
      
      customerAcc = await Account.create({
        partyId,
        name: `${party.name} Wallet`,
        type: 'LIABILITY',
        subtype: 'CUSTOMER_WALLET',
        currency: 'USD',
        accountNumber: accNum,
      });
    }
    
    const bankCash = await getGLAccount('SETTLEMENT');
    requireActive(bankCash);
 
    const result = await postTransaction({
      type: 'WITHDRAWAL', 
      description: description || 'Gave Items on Credit',
      totalAmount: amount,
      entries: [
        { accountId: customerAcc._id, direction: 'DEBIT',  amount }, 
        { accountId: bankCash._id,    direction: 'CREDIT', amount }, 
      ],
      user: req.user, req, postImmediately: true,
      metadata: {
        ...metadata,
        partyId,
        shopkeeperTxnType: 'CREDIT_SALE'
      }
    });

    // Re-evaluate manufacturing after any item sale path as well.
    try {
      const items = metadata?.items || [];
      if (manufacturingService && Array.isArray(items) && items.length) {
        manufacturingService.handleSale(items, req.user).catch(e => console.error('manufacturing.handleSale error', e && e.message));
      }
    } catch (e) { console.error('manufacturing hook failed', e && e.message); }

    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

// POST /api/transactions/receive-payment (Shopkeeper: Got Paid)
const receivePayment = async (req, res, next) => {
  try {
    const { partyId, amount, description } = req.body;
    let customerAcc = await Account.findOne({ partyId, status: 'ACTIVE' });
    if (!customerAcc) {
      const Party = require('../models/Party');
      const { nanoid } = require('nanoid');
      const party = await Party.findById(partyId);
      if (!party) return res.status(404).json({ success: false, message: 'Party not found' });
      
      const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const accNum = `ACC-${d}-${nanoid(5).toUpperCase()}`;
      
      customerAcc = await Account.create({
        partyId,
        name: `${party.name} Wallet`,
        type: 'LIABILITY',
        subtype: 'CUSTOMER_WALLET',
        currency: 'USD',
        accountNumber: accNum,
      });
    }
    
    const bankCash = await getGLAccount('SETTLEMENT');
    requireActive(bankCash);

    const result = await postTransaction({
      type: 'DEPOSIT', 
      description: description || 'Received Payment',
      totalAmount: amount,
      entries: [
        { accountId: bankCash._id,    direction: 'DEBIT',  amount }, 
        { accountId: customerAcc._id, direction: 'CREDIT', amount }, 
      ],
      user: req.user, req, postImmediately: true,
    });
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

// POST /api/transactions/buy-sold (Shopkeeper: Buy/Sold Direct Cash Transaction)
const buySold = async (req, res, next) => {
  try {
    const { partyId, direction, amount, description, metadata } = req.body;
    
    const bankCash = await getGLAccount('SETTLEMENT');
    requireActive(bankCash);

    let entries = [];
    let txnType = 'DEPOSIT';

    if (direction === 'SOLD') {
      const revenueAcc = await getGLAccount('FEE_INCOME');
      requireActive(revenueAcc);
      txnType = 'DEPOSIT';
      entries = [
        { accountId: bankCash._id,   direction: 'DEBIT',  amount }, 
        { accountId: revenueAcc._id, direction: 'CREDIT', amount }, 
      ];
    } else {
      const expenseAcc = await getGLAccount('CHARGEBACK');
      requireActive(expenseAcc);
      txnType = 'WITHDRAWAL';
      entries = [
        { accountId: expenseAcc._id, direction: 'DEBIT',  amount }, 
        { accountId: bankCash._id,   direction: 'CREDIT', amount }, 
      ];
    }

    const result = await postTransaction({
      type: txnType, 
      description: description || (direction === 'SOLD' ? 'Direct Cash Sale' : 'Direct Cash Purchase'),
      totalAmount: amount,
      entries,
      user: req.user,
      req,
      postImmediately: true,
      metadata: {
        ...metadata,
        partyId,
        shopkeeperTxnType: 'BUY_SOLD',
        direction
      }
    });

    // Trigger manufacturing automation if items present
    try {
      const items = metadata?.items || [];
      if (manufacturingService && Array.isArray(items) && items.length) {
        if (direction === 'BUY') {
          manufacturingService.handlePurchase(items, req.user).catch(e => console.error('manufacturing.handlePurchase error', e && e.message));
        } else if (direction === 'SOLD') {
          manufacturingService.handleSale(items, req.user).catch(e => console.error('manufacturing.handleSale error', e && e.message));
        }
      }
    } catch (e) { console.error('manufacturing hook failed', e && e.message); }

    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

// DELETE /api/transactions/:id  (hard delete — reverses balances)
const deleteTransaction = async (req, res, next) => {
  try {
    const txn = await Transaction.findById(req.params.id);
    if (!txn) return res.status(404).json({ success: false, message: 'Transaction not found' });

    // Fetch all journal entries for this transaction
    const entries = await Entry.find({ transactionId: txn._id });

    // Reverse each entry's effect on account balances
    for (const entry of entries) {
      // When we posted: CREDIT → +balance, DEBIT → -balance
      // To reverse:    CREDIT → -balance, DEBIT → +balance
      const delta = entry.direction === 'CREDIT' ? -entry.amount : entry.amount;
      await Account.findByIdAndUpdate(entry.accountId, {
        $inc: { currentBalance: delta, availableBalance: delta },
      });
    }

    // Delete all entries and the transaction itself
    await Entry.deleteMany({ transactionId: txn._id });
    await Transaction.findByIdAndDelete(txn._id);

    res.json({ success: true, message: 'Transaction deleted and balances reversed' });
  } catch (err) { next(err); }
};

module.exports = { list, getOne, deposit, withdrawal, transfer, fee, refund, capture, reverse, creditSale, receivePayment, buySold, deleteTransaction };
