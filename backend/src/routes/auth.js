const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { login, logout, getMe, changePassword } = require('../controllers/auth');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  validate,
  login
);

router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.patch('/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }).withMessage('Min 8 characters'),
  ],
  validate,
  changePassword
);

module.exports = router;
