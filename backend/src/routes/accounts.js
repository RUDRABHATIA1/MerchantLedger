const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/accounts');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/',
  authorize('ADMIN', 'TELLER'),
  [
    body('partyId').optional().isMongoId(),
    body('name').notEmpty(),
    body('type').isIn(['ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY']),
    body('subtype').optional().isIn(['CUSTOMER_WALLET', 'SAVINGS', 'MERCHANT', 'SETTLEMENT', 'FEE_INCOME', 'CHARGEBACK', 'GENERAL']),
    body('currency').optional().isLength({ min: 3, max: 3 }),
  ],
  validate,
  ctrl.create
);
router.get('/gl-summary', ctrl.glSummary);
router.get('/:id', ctrl.getOne);
router.patch('/:id/status',
  authorize('ADMIN'),
  [body('status').isIn(['ACTIVE', 'FROZEN', 'CLOSED'])],
  validate,
  ctrl.updateStatus
);
router.get('/:id/statement', ctrl.statement);
router.get('/:id/balance', ctrl.balance);

module.exports = router;
