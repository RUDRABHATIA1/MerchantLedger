const Transaction = require('../models/Transaction');

/**
 * Idempotency middleware — checks for duplicate (clientId, idempotencyKey).
 * If a duplicate is found, returns the original transaction immediately.
 * Attaches req.idempotencyKey and req.clientId for the controller.
 */
const idempotencyCheck = async (req, res, next) => {
  const idempotencyKey = req.headers['x-idempotency-key'];
  const clientId = req.headers['x-client-id'] || 'default';

  if (!idempotencyKey) return next();

  req.idempotencyKey = idempotencyKey;
  req.clientId = clientId;

  try {
    const existing = await Transaction.findOne({ idempotencyKey, clientId }).lean();
    if (existing) {
      return res.status(200).json({
        success: true,
        idempotent: true,
        message: 'Duplicate request — returning original transaction',
        data: existing,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { idempotencyCheck };
