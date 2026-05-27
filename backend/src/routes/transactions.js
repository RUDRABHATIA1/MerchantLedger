const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/transactions');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idempotencyCheck } = require('../middleware/idempotency');

router.use(authenticate);

const amountBody = body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be > 0');
const accountBody = (field) => body(field).isMongoId().withMessage(`${field} must be a valid account ID`);

// List all transactions
router.get('/', ctrl.list);

// Deposit
router.post('/credit-sale',
  authorize('ADMIN', 'TELLER'),
  [
    body('partyId').notEmpty().withMessage('partyId is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be positive'),
    body('description').optional().isString(),
  ],
  validate,
  ctrl.creditSale
);

router.post('/receive-payment',
  authorize('ADMIN', 'TELLER'),
  [
    body('partyId').notEmpty().withMessage('partyId is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be positive'),
    body('description').optional().isString(),
  ],
  validate,
  ctrl.receivePayment
);

router.post('/buy-sold',
  authorize('ADMIN', 'TELLER'),
  [
    body('partyId').notEmpty().withMessage('partyId is required'),
    body('direction').isIn(['BUY', 'SOLD']).withMessage('Direction must be BUY or SOLD'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be positive'),
    body('description').optional().isString(),
    body('metadata').optional().isObject(),
  ],
  validate,
  ctrl.buySold
);

router.post('/deposit',
  authorize('ADMIN', 'TELLER'), idempotencyCheck,
  [amountBody, accountBody('accountId'), body('description').optional()],
  validate, ctrl.deposit
);

// Withdrawal
router.post('/withdrawal',
  authorize('ADMIN', 'TELLER'), idempotencyCheck,
  [amountBody, accountBody('accountId'), body('description').optional()],
  validate, ctrl.withdrawal
);

// Transfer
router.post('/transfer',
  authorize('ADMIN', 'TELLER'), idempotencyCheck,
  [
    amountBody,
    accountBody('fromAccountId'),
    accountBody('toAccountId'),
    body('feeAmount').optional().isFloat({ min: 0 }),
    body('description').optional(),
  ],
  validate, ctrl.transfer
);

// Fee posting
router.post('/fee',
  authorize('ADMIN', 'TELLER'), idempotencyCheck,
  [amountBody, accountBody('accountId'), body('description').optional()],
  validate, ctrl.fee
);

// Refund
router.post('/refund',
  authorize('ADMIN', 'TELLER'), idempotencyCheck,
  [amountBody, accountBody('accountId'), body('description').optional()],
  validate, ctrl.refund
);

// Capture pending → posted
router.post('/:id/capture',
  authorize('ADMIN', 'TELLER'),
  ctrl.capture
);

// Reverse a posted transaction
router.post('/:id/reverse',
  authorize('ADMIN'),
  [body('description').optional()],
  validate, ctrl.reverse
);

// Delete a transaction (hard delete, reverses balances) — ADMIN only
router.delete('/:id',
  authorize('ADMIN'),
  ctrl.deleteTransaction
);

// Get single transaction with entries
router.get('/:id', ctrl.getOne);

module.exports = router;
