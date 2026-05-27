const Transaction = require('../models/Transaction');
const Entry = require('../models/Entry');
const Account = require('../models/Account');
const Party = require('../models/Party');

// GET /api/reports/dashboard
const dashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    const [
      totalAccounts, totalParties, totalTransactions,
      todayDeposits, todayWithdrawals, todayTransfers, todayFees,
      pendingCount,
      recentTxns,
      typeBreakdown,
      last7Days,
    ] = await Promise.all([
      Account.countDocuments({ status: 'ACTIVE' }),
      Party.countDocuments({ isActive: true }),
      Transaction.countDocuments({ status: 'POSTED' }),

      Transaction.aggregate([{ $match: { type: 'DEPOSIT',    status: 'POSTED', createdAt: { $gte: today, $lt: tomorrow } } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }]),
      Transaction.aggregate([{ $match: { type: 'WITHDRAWAL', status: 'POSTED', createdAt: { $gte: today, $lt: tomorrow } } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }]),
      Transaction.aggregate([{ $match: { type: 'TRANSFER',   status: 'POSTED', createdAt: { $gte: today, $lt: tomorrow } } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }]),
      Transaction.aggregate([{ $match: { type: 'FEE',        status: 'POSTED', createdAt: { $gte: today, $lt: tomorrow } } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }]),

      Transaction.countDocuments({ status: 'PENDING' }),
      Transaction.find({ status: 'POSTED' }).populate('createdBy', 'name').sort({ createdAt: -1 }).limit(8),

      Transaction.aggregate([
        { $match: { status: 'POSTED' } },
        { $group: { _id: '$type', count: { $sum: 1 }, volume: { $sum: '$totalAmount' } } },
      ]),

      // Last 7 days daily deposit/withdrawal volumes
      Transaction.aggregate([
        {
          $match: {
            status: 'POSTED',
            type: { $in: ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER'] },
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, type: '$type' },
            total: { $sum: '$totalAmount' },
          },
        },
        { $sort: { '_id.date': 1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        summary: {
          totalAccounts, totalParties, totalTransactions, pendingCount,
          todayDeposits:    { total: todayDeposits[0]?.total || 0,    count: todayDeposits[0]?.count || 0 },
          todayWithdrawals: { total: todayWithdrawals[0]?.total || 0, count: todayWithdrawals[0]?.count || 0 },
          todayTransfers:   { total: todayTransfers[0]?.total || 0,   count: todayTransfers[0]?.count || 0 },
          todayFees:        { total: todayFees[0]?.total || 0,        count: todayFees[0]?.count || 0 },
        },
        recentTransactions: recentTxns,
        typeBreakdown,
        last7Days,
      },
    });
  } catch (err) { next(err); }
};

// GET /api/reports/trial-balance
const trialBalance = async (req, res, next) => {
  try {
    const accounts = await Account.find().populate('partyId', 'name').select('accountNumber name type subtype currentBalance availableBalance currency status isSystemAccount');
    const grouped = {};
    for (const acc of accounts) {
      if (!grouped[acc.type]) grouped[acc.type] = { type: acc.type, accounts: [], totalBalance: 0 };
      grouped[acc.type].accounts.push(acc);
      grouped[acc.type].totalBalance += acc.currentBalance;
    }
    const totalDebits  = (grouped['ASSET']?.totalBalance || 0) + (grouped['EXPENSE']?.totalBalance || 0);
    const totalCredits = (grouped['LIABILITY']?.totalBalance || 0) + (grouped['INCOME']?.totalBalance || 0) + (grouped['EQUITY']?.totalBalance || 0);
    res.json({
      success: true,
      data: {
        groups: Object.values(grouped),
        totals: { totalDebits, totalCredits, balanced: Math.abs(totalDebits - totalCredits) < 0.01 },
        generatedAt: new Date(),
      },
    });
  } catch (err) { next(err); }
};

// GET /api/reports/reconciliation
const reconciliation = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const filter = { status: 'POSTED' };
    if (from || to) {
      filter.postedAt = {};
      if (from) filter.postedAt.$gte = new Date(from);
      if (to)   filter.postedAt.$lte = new Date(to + 'T23:59:59Z');
    }

    const transactions = await Transaction.find(filter).lean();
    const results = [];
    let unbalancedCount = 0;

    for (const txn of transactions) {
      const entries = await Entry.find({ transactionId: txn._id }).lean();
      let debitSum = 0, creditSum = 0;
      entries.forEach((e) => {
        if (e.direction === 'DEBIT')  debitSum  += e.amount;
        if (e.direction === 'CREDIT') creditSum += e.amount;
      });
      const diff = Math.round((debitSum - creditSum) * 100) / 100;
      const balanced = diff === 0;
      if (!balanced) unbalancedCount++;
      results.push({ transaction: txn.reference, type: txn.type, debitSum, creditSum, diff, balanced, entryCount: entries.length });
    }

    res.json({
      success: true,
      data: {
        totalChecked: transactions.length,
        balanced: transactions.length - unbalancedCount,
        unbalanced: unbalancedCount,
        results,
        generatedAt: new Date(),
      },
    });
  } catch (err) { next(err); }
};

// GET /api/reports/daily-totals
const dailyTotals = async (req, res, next) => {
  try {
    const { date } = req.query;
    const target = date ? new Date(date) : new Date();
    target.setHours(0, 0, 0, 0);
    const next = new Date(target); next.setDate(target.getDate() + 1);

    const totals = await Transaction.aggregate([
      { $match: { status: 'POSTED', createdAt: { $gte: target, $lt: next } } },
      { $group: { _id: '$type', count: { $sum: 1 }, volume: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data: { date: target.toISOString().slice(0, 10), totals } });
  } catch (err) { next(err); }
};

// GET /api/reports/profit-summary
const profitSummary = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from || to) {
      dateFilter.$gte = from ? new Date(from) : new Date(0);
      const end = to ? new Date(to) : new Date();
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    // 1. Manufacturing Expenses (Monthly Overheads) — optional
    let manufacturingExpenses = 0;
    let dailyExpAgg = [];
    try {
      const ManufacturingExpense = require('../models/ManufacturingExpense');
      const expMatch = {};
      if (from || to) {
        expMatch.expenseMonth = {};
        if (from) expMatch.expenseMonth.$gte = new Date(from).toISOString().slice(0, 7);
        if (to) expMatch.expenseMonth.$lte = new Date(to).toISOString().slice(0, 7);
      }
      const expAgg = await ManufacturingExpense.aggregate([
        { $match: expMatch },
        { $group: { _id: null, totalExp: { $sum: '$amount' } } }
      ]);
      manufacturingExpenses = expAgg[0]?.totalExp || 0;

      // Monthly manufacturing expenses
      dailyExpAgg = await ManufacturingExpense.aggregate([
        { $match: expMatch },
        { $group: { _id: '$expenseMonth', amount: { $sum: '$amount' } } },
        { $sort: { _id: 1 } }
      ]);
    } catch (e) {
      // ManufacturingExpense model not present — skip manufacturing aggregations
      manufacturingExpenses = 0;
      dailyExpAgg = [];
    }

    // 2. Trading Profit & Godown Items
    // For godown we need all history, for profit we only need filtered date
    const txns = await Transaction.find({
      status: 'POSTED',
      'metadata.items': { $exists: true, $not: { $size: 0 } }
    });

    const rawItems = [];
    txns.forEach(t => {
      const itemsList = t.metadata.items || [];
      const shopType = t.metadata.shopkeeperTxnType;
      
      itemsList.forEach(item => {
        if (!item.item) return;
        let direction = item.direction;
        if (!direction) {
          direction = shopType === 'CREDIT_SALE' ? 'SOLD' : (t.metadata.direction || 'SOLD');
        }
        
        const inDateRange = (!from && !to) || (t.createdAt >= dateFilter.$gte && t.createdAt <= dateFilter.$lte);

        rawItems.push({
          name: item.item.trim().toLowerCase(),
          originalName: item.item.trim(),
          quantity: parseFloat(item.quantity) || 0,
          eachCost: parseFloat(item.eachCost) || 0,
          direction,
          date: t.createdAt.toISOString().slice(0, 10),
          inDateRange
        });
      });
    });

    const itemsMap = {};
    const dailyTradingMap = {};

    rawItems.forEach(e => {
      if (!itemsMap[e.name]) {
        itemsMap[e.name] = { name: e.originalName, qtyBought: 0, qtySold: 0, qtyConsumed: 0, amountBought: 0, amountSold: 0, profitInRange: 0 };
      }
      const it = itemsMap[e.name];
      if (e.direction === 'BUY' || e.direction === 'PRODUCED') {
        it.qtyBought += e.quantity;
        it.amountBought += e.quantity * e.eachCost;
      } else if (e.direction === 'CONSUMED') {
        it.qtyConsumed += e.quantity;
      } else {
        it.qtySold += e.quantity;
        it.amountSold += e.quantity * e.eachCost;
      }
    });

    let tradingProfit = 0;
    const godownItems = [];
    let totalStockValue = 0;

    Object.values(itemsMap).forEach(it => {
      const avgPurchaseCost = it.qtyBought > 0 ? (it.amountBought / it.qtyBought) : 0;
      const qtyLeft = it.qtyBought - it.qtySold - it.qtyConsumed;
      const stockValue = qtyLeft > 0 ? (qtyLeft * avgPurchaseCost) : 0;
      
      godownItems.push({
        name: it.name,
        qtyLeft,
        avgPurchaseCost,
        stockValue
      });
      totalStockValue += stockValue;
    });

    // Calculate trading profit only for the date range
    rawItems.filter(e => e.inDateRange && e.direction === 'SOLD').forEach(e => {
      const it = itemsMap[e.name];
      const avgPurchaseCost = it.qtyBought > 0 ? (it.amountBought / it.qtyBought) : 0;
      const profit = (e.quantity * e.eachCost) - (e.quantity * avgPurchaseCost);
      tradingProfit += profit;
      
      dailyTradingMap[e.date] = (dailyTradingMap[e.date] || 0) + profit;
    });

    const dailyTradingProfit = Object.entries(dailyTradingMap).map(([date, profit]) => ({ _id: date, profit })).sort((a, b) => a._id.localeCompare(b._id));

    res.json({
      success: true,
      data: {
        tradingProfit,
        manufacturingExpenses,
        totalProfit: tradingProfit - manufacturingExpenses,
        godownItems: godownItems.sort((a, b) => b.stockValue - a.stockValue),
        totalStockValue,
        dailyTradingProfit,
        dailyManufacturingExpenses: dailyExpAgg
      }
    });
  } catch (err) { next(err); }
};

module.exports = { dashboard, trialBalance, reconciliation, dailyTotals, profitSummary };
