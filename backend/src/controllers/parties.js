const Party = require('../models/Party');
const Account = require('../models/Account');
const Entry = require('../models/Entry');
const { nanoid } = require('nanoid');
const { writeAuditLog } = require('../middleware/audit');

const genAccountNumber = () => {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `ACC-${d}-${nanoid(5).toUpperCase()}`;
};

// GET /api/parties
const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, type, kycStatus } = req.query;
    const filter = { isActive: true };
    if (type) filter.type = type;
    if (kycStatus) filter.kycStatus = kycStatus;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
    const [data, total] = await Promise.all([
      Party.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(+limit),
      Party.countDocuments(filter),
    ]);
    res.json({ success: true, data, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

// POST /api/parties
const create = async (req, res, next) => {
  try {
    const party = await Party.create(req.body);
    
    // Auto-create matching Customer Ledger Wallet account for the party
    const account = await Account.create({
      partyId: party._id,
      name: `${party.name} Wallet`,
      type: 'LIABILITY',
      subtype: 'CUSTOMER_WALLET',
      currency: 'USD',
      accountNumber: genAccountNumber(),
    });

    await writeAuditLog({
      userId: req.user._id, userName: req.user.name, userRole: req.user.role,
      action: 'CREATE_PARTY', entityType: 'Party', entityId: party._id,
      summary: `Created party: ${party.name} and auto-created account ${account.accountNumber}`, req,
    });
    
    res.status(201).json({ success: true, data: party });
  } catch (err) { next(err); }
};

// GET /api/parties/:id
const getOne = async (req, res, next) => {
  try {
    const party = await Party.findById(req.params.id);
    if (!party) return res.status(404).json({ success: false, message: 'Party not found' });
    const accounts = await Account.find({ partyId: party._id }).select('-__v');
    res.json({ success: true, data: { ...party.toObject(), accounts } });
  } catch (err) { next(err); }
};

// PATCH /api/parties/:id
const update = async (req, res, next) => {
  try {
    const allowed = ['name', 'email', 'phone', 'address', 'notes'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const party = await Party.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!party) return res.status(404).json({ success: false, message: 'Party not found' });
    res.json({ success: true, data: party });
  } catch (err) { next(err); }
};

// PATCH /api/parties/:id/kyc
const updateKyc = async (req, res, next) => {
  try {
    const { status } = req.body;
    const party = await Party.findByIdAndUpdate(
      req.params.id,
      { kycStatus: status, kycVerifiedAt: status === 'VERIFIED' ? new Date() : null },
      { new: true }
    );
    if (!party) return res.status(404).json({ success: false, message: 'Party not found' });
    await writeAuditLog({
      userId: req.user._id, userName: req.user.name, userRole: req.user.role,
      action: 'UPDATE_KYC', entityType: 'Party', entityId: party._id,
      summary: `KYC status → ${status} for ${party.name}`, req, severity: 'WARN',
    });
    res.json({ success: true, data: party });
  } catch (err) { next(err); }
};

// DELETE /api/parties/:id (soft delete)
const deactivate = async (req, res, next) => {
  try {
    await Party.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Party deactivated' });
  } catch (err) { next(err); }
};

// GET /api/parties/:id/statement
const statement = async (req, res, next) => {
  try {
    const { from, to, page = 1, limit = 30 } = req.query;
    const accounts = await Account.find({ partyId: req.params.id }).select('_id');
    const accountIds = accounts.map(a => a._id);
    
    const bankCash = await Account.findOne({ isSystemAccount: true, subtype: 'SETTLEMENT' });
    const bankCashId = bankCash ? bankCash._id : null;

    const Transaction = require('../models/Transaction');
    const txns = await Transaction.find({ 'metadata.partyId': req.params.id }).select('_id');
    const txnIds = txns.map(t => t._id);

    const filter = {
      $or: [
        { accountId: { $in: accountIds } },
        { transactionId: { $in: txnIds }, accountId: bankCashId }
      ]
    };

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to + 'T23:59:59Z');
    }
    
    const [entries, total] = await Promise.all([
      Entry.find(filter)
        .populate('accountId', 'accountNumber name type isSystemAccount')
        .populate('transactionId', 'reference type status description postedAt metadata')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(+limit),
      Entry.countDocuments(filter),
    ]);
    
    res.json({ success: true, data: entries, total, page: +page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

module.exports = { list, create, getOne, update, updateKyc, deactivate, statement };
