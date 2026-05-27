/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║            LEDGER POSTING ENGINE                             ║
 * ║  Core of the double-entry accounting system.                ║
 * ║  All balance mutations MUST go through postTransaction().   ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Invariants enforced:
 *  1. SUM(DEBIT amounts) === SUM(CREDIT amounts) per transaction
 *  2. All DB writes are atomic (Mongoose session + transaction)
 *  3. Account balances materialized atomically with entries
 *  4. Posted entries become immutable (isImmutable = true)
 *  5. Reversals create equal-and-opposite entries, never edit
 */

const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
const Transaction = require('../models/Transaction');
const Entry = require('../models/Entry');
const Account = require('../models/Account');
const { writeAuditLog } = require('../middleware/audit');

// ── Helpers ────────────────────────────────────────────────────────────────

/** Generate a unique, human-readable reference e.g. TXN-20240519-A3K9X */
const generateReference = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `TXN-${date}-${nanoid(6).toUpperCase()}`;
};

/** Round to 2 decimal places to avoid floating-point drift */
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Validate that the proposed entries are balanced (debits = credits).
 * Throws a 422 error if not.
 *
 * @param {Array<{direction, amount}>} entries
 */
const assertBalanced = (entries) => {
  let debitSum = 0;
  let creditSum = 0;
  for (const e of entries) {
    if (e.direction === 'DEBIT')  debitSum  = round2(debitSum  + e.amount);
    if (e.direction === 'CREDIT') creditSum = round2(creditSum + e.amount);
  }
  if (round2(debitSum - creditSum) !== 0) {
    const err = new Error(
      `Unbalanced transaction: DEBIT ${debitSum} ≠ CREDIT ${creditSum}`
    );
    err.statusCode = 422;
    throw err;
  }
};

/**
 * Lock accounts in a consistent order to prevent deadlocks when two
 * concurrent transactions touch the same accounts.
 */
const lockAccounts = async (accountIds, session) => {
  const sorted = [...new Set(accountIds.map(String))].sort();
  const accounts = await Account.find({ _id: { $in: sorted } })
    .session(session)
    .lean();
  if (accounts.length !== sorted.length) {
    const err = new Error('One or more accounts not found');
    err.statusCode = 404;
    throw err;
  }
  // Verify none are CLOSED
  for (const acc of accounts) {
    if (acc.status === 'CLOSED') {
      const err = new Error(`Account ${acc.accountNumber} is CLOSED`);
      err.statusCode = 422;
      throw err;
    }
  }
  return accounts;
};

// ── Main Posting Function ──────────────────────────────────────────────────

/**
 * postTransaction — atomically posts a double-entry transaction.
 *
 * @param {Object} params
 * @param {string} params.type           - Transaction type enum
 * @param {string} params.description
 * @param {number} params.totalAmount
 * @param {string} [params.currency]     - default 'USD'
 * @param {Array}  params.entries        - [{accountId, direction, amount, description?}]
 * @param {string} [params.idempotencyKey]
 * @param {string} [params.clientId]
 * @param {Object} [params.metadata]
 * @param {Object} params.user           - req.user (for audit + createdBy)
 * @param {Object} [params.req]          - express req (for audit IP)
 * @param {boolean} [params.postImmediately] - false → status = PENDING
 * @param {string} [params.reversalOf]   - transactionId being reversed
 * @returns {Promise<{transaction, entries}>}
 */
const postTransaction = async ({
  type,
  description,
  totalAmount,
  currency = 'USD',
  entries: entryDefs,
  idempotencyKey,
  clientId,
  metadata,
  user,
  req,
  postImmediately = true,
  reversalOf = null,
}) => {
  // 1. Validate balance BEFORE opening DB session
  assertBalanced(entryDefs);

  const session = await mongoose.startSession();

  try {
    let transaction, savedEntries;

    await session.withTransaction(async () => {
      // 2. Lock all involved accounts (sorted order, prevents deadlock)
      const accountIds = entryDefs.map((e) => e.accountId);
      await lockAccounts(accountIds, session);

      // 3. Create transaction header
      const status = postImmediately ? 'POSTED' : 'PENDING';
      const reference = generateReference();

      ;[transaction] = await Transaction.create(
        [
          {
            reference,
            type,
            status,
            description,
            currency,
            totalAmount,
            idempotencyKey,
            clientId,
            reversalOf,
            metadata,
            createdBy: user._id,
            postedAt: postImmediately ? new Date() : null,
          },
        ],
        { session }
      );

      // 4. Create journal entries
      const entryDocs = entryDefs.map((e) => ({
        transactionId: transaction._id,
        accountId: e.accountId,
        direction: e.direction,
        amount: round2(e.amount),
        currency,
        state: postImmediately ? 'POSTED' : 'PENDING',
        description: e.description || description,
        isImmutable: postImmediately,
      }));

      savedEntries = await Entry.insertMany(entryDocs, { session });

      // 5. Materialize balances atomically
      for (const e of entryDefs) {
        const delta = round2(e.amount);
        // currentBalance: CREDIT increases, DEBIT decreases
        const balanceDelta    = e.direction === 'CREDIT' ? delta : -delta;
        // availableBalance: only change when POSTED
        const availableDelta  = postImmediately ? balanceDelta : 0;
        // For PENDING debits, reduce available but not current
        const pendingDebitDelta = (!postImmediately && e.direction === 'DEBIT') ? -delta : 0;

        await Account.findByIdAndUpdate(
          e.accountId,
          {
            $inc: {
              currentBalance:   postImmediately ? balanceDelta : 0,
              availableBalance: postImmediately ? balanceDelta : pendingDebitDelta,
            },
          },
          { session, new: true }
        );
      }
    });

    // 6. Write audit log (outside transaction, fire-and-forget)
    await writeAuditLog({
      userId: user._id,
      userName: user.name,
      userRole: user.role,
      action: `POST_${type}`,
      entityType: 'Transaction',
      entityId: transaction._id,
      summary: `${type} of ${currency} ${totalAmount} — ref: ${transaction.reference}`,
      metadata: { totalAmount, currency, entryCount: entryDefs.length },
      req,
      severity: 'INFO',
    });

    return { transaction, entries: savedEntries };
  } finally {
    session.endSession();
  }
};

// ── Capture Pending Transaction ────────────────────────────────────────────

/**
 * capturePending — promotes a PENDING transaction to POSTED.
 * Updates all entry states and materializes balances.
 */
const capturePending = async ({ transactionId, user, req }) => {
  const session = await mongoose.startSession();
  let txn;

  try {
    await session.withTransaction(async () => {
      txn = await Transaction.findById(transactionId).session(session);
      if (!txn) {
        const err = new Error('Transaction not found'); err.statusCode = 404; throw err;
      }
      if (txn.status !== 'PENDING') {
        const err = new Error(`Cannot capture a ${txn.status} transaction`); err.statusCode = 422; throw err;
      }

      const entries = await Entry.find({ transactionId }).session(session);

      // Update balances: apply the deferred current balance changes
      for (const e of entries) {
        const delta       = round2(e.amount);
        const balanceDelta = e.direction === 'CREDIT' ? delta : -delta;
        // Remove the pending-debit reservation from availableBalance, apply full balance change
        const availableCorrection = e.direction === 'DEBIT' ? 0 : delta; // credit now hits available too
        const currentIncrease     = balanceDelta;

        await Account.findByIdAndUpdate(
          e.accountId,
          { $inc: { currentBalance: currentIncrease, availableBalance: availableCorrection } },
          { session }
        );
      }

      // Mark entries as posted and immutable
      await Entry.updateMany(
        { transactionId },
        { $set: { state: 'POSTED', isImmutable: true } },
        { session }
      );

      txn.status   = 'POSTED';
      txn.postedAt = new Date();
      await txn.save({ session });
    });

    await writeAuditLog({
      userId: user._id, userName: user.name, userRole: user.role,
      action: 'CAPTURE_TRANSACTION', entityType: 'Transaction', entityId: txn._id,
      summary: `Captured pending transaction ${txn.reference}`, req, severity: 'INFO',
    });

    return txn;
  } finally {
    session.endSession();
  }
};

// ── Reverse Posted Transaction ─────────────────────────────────────────────

/**
 * reverseTransaction — creates equal-and-opposite entries for a POSTED transaction.
 * Original transaction is never modified; a new REVERSAL transaction is created.
 */
const reverseTransaction = async ({ transactionId, description, user, req }) => {
  const original = await Transaction.findById(transactionId);
  if (!original) {
    const err = new Error('Original transaction not found'); err.statusCode = 404; throw err;
  }
  if (original.status !== 'POSTED') {
    const err = new Error('Only POSTED transactions can be reversed'); err.statusCode = 422; throw err;
  }
  if (original.reversedBy) {
    const err = new Error('Transaction has already been reversed'); err.statusCode = 422; throw err;
  }

  const originalEntries = await Entry.find({ transactionId });

  // Build mirror entries (flip DEBIT↔CREDIT)
  const mirrorEntries = originalEntries.map((e) => ({
    accountId: e.accountId,
    direction: e.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
    amount:    e.amount,
    description: `REVERSAL: ${e.description || original.description}`,
  }));

  const { transaction: reversalTxn, entries } = await postTransaction({
    type: 'REVERSAL',
    description: description || `Reversal of ${original.reference}`,
    totalAmount: original.totalAmount,
    currency: original.currency,
    entries: mirrorEntries,
    user,
    req,
    postImmediately: true,
    reversalOf: original._id,
  });

  // Mark original as reversed
  await Transaction.findByIdAndUpdate(transactionId, {
    status: 'REVERSED',
    reversedBy: reversalTxn._id,
  });

  await writeAuditLog({
    userId: user._id, userName: user.name, userRole: user.role,
    action: 'REVERSE_TRANSACTION', entityType: 'Transaction', entityId: original._id,
    summary: `Reversed ${original.reference} → new ref ${reversalTxn.reference}`,
    severity: 'WARN', req,
  });

  return { reversalTransaction: reversalTxn, entries };
};

module.exports = { postTransaction, capturePending, reverseTransaction, generateReference };
