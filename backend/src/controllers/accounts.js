const Account = require('../models/Account');
const Entry = require('../models/Entry');
const Transaction = require('../models/Transaction');
const { nanoid } = require('nanoid');
const { writeAuditLog } = require('../middleware/audit');

/** Auto-generate account number: ACC-YYYYMMDD-XXXXX */
const genAccountNumber = () => {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `ACC-${d}-${nanoid(5).toUpperCase()}`;
};

// GET /api/accounts
const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, subtype, status, partyId, search } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (subtype) filter.subtype = subtype;
    if (status) filter.status = status;
    if (partyId) filter.partyId = partyId;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { accountNumber: { $regex: search, $options: 'i' } },
    ];
    const [data, total] = await Promise.all([
      Account.find(filter).populate('partyId', 'name email type').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(+limit),
      Account.countDocuments(filter),
    ]);
    res.json({ success: true, data, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// POST /api/accounts
const create = async (req, res, next) => {
  try {
    const account = await Account.create({
      ...req.body,
      accountNumber: genAccountNumber(),
    });
    await writeAuditLog({
      userId: req.user._id, userName: req.user.name, userRole: req.user.role,
      action: 'CREATE_ACCOUNT', entityType: 'Account', entityId: account._id,
      summary: `Created account ${account.accountNumber} (${account.type})`, req,
    });
    res.status(201).json({ success: true, data: account });
  } catch (err) { next(err); }
};

// GET /api/accounts/:id
const getOne = async (req, res, next) => {
  try {
    const account = await Account.findById(req.params.id).populate('partyId', 'name email type kycStatus');
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    res.json({ success: true, data: account });
  } catch (err) { next(err); }
};

// PATCH /api/accounts/:id/status
const updateStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    const update = { status };
    if (status === 'FROZEN') update.frozenReason = reason;
    if (status === 'CLOSED') update.closedAt = new Date();
    const account = await Account.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    await writeAuditLog({
      userId: req.user._id, userName: req.user.name, userRole: req.user.role,
      action: `ACCOUNT_${status}`, entityType: 'Account', entityId: account._id,
      summary: `Account ${account.accountNumber} → ${status}${reason ? ': ' + reason : ''}`,
      req, severity: status === 'CLOSED' ? 'CRITICAL' : 'WARN',
    });
    res.json({ success: true, data: account });
  } catch (err) { next(err); }
};

// GET /api/accounts/:id/statement
const statement = async (req, res, next) => {
  try {
    const { from, to, page = 1, limit = 30, state } = req.query;
    const filter = { accountId: req.params.id };
    if (state) filter.state = state;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to + 'T23:59:59Z');
    }
    const [entries, total] = await Promise.all([
      Entry.find(filter)
        .populate('transactionId', 'reference type status description postedAt metadata')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(+limit),
      Entry.countDocuments(filter),
    ]);
    const account = await Account.findById(req.params.id).select('accountNumber currentBalance availableBalance currency name');
    res.json({ success: true, account, data: entries, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// GET /api/accounts/:id/balance
const balance = async (req, res, next) => {
  try {
    const account = await Account.findById(req.params.id).select('accountNumber name currentBalance availableBalance currency status');
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    res.json({ success: true, data: account });
  } catch (err) { next(err); }
};

// GET /api/accounts/gl-summary
const glSummary = async (req, res, next) => {
  try {
    const summary = await Account.aggregate([
      { $group: { _id: '$type', totalBalance: { $sum: '$currentBalance' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
};

module.exports = { list, create, getOne, updateStatus, statement, balance, glSummary };
