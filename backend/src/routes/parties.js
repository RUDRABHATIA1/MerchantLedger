const express = require('express');
const { body, query } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/parties');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/',
  authorize('ADMIN', 'TELLER'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').optional().isEmail(),
    body('type').optional().isIn(['INDIVIDUAL', 'CORPORATE']),
  ],
  validate,
  ctrl.create
);
router.get('/:id', ctrl.getOne);
router.patch('/:id',
  authorize('ADMIN', 'TELLER'),
  ctrl.update
);
router.get('/:id/statement', ctrl.statement);
router.patch('/:id/kyc',
  authorize('ADMIN'),
  [body('status').isIn(['PENDING', 'VERIFIED', 'REJECTED'])],
  validate,
  ctrl.updateKyc
);
router.delete('/:id', authorize('ADMIN'), ctrl.deactivate);

module.exports = router;
