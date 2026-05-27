const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

router.use(authenticate, authorize('ADMIN'));

// List users
router.get('/', async (req, res, next) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  } catch (err) { next(err); }
});

// Create user
router.post('/',
  [
    body('name').notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 8 }),
    body('role').isIn(['ADMIN', 'TELLER', 'AUDITOR']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, password, role } = req.body;
      const existing = await User.findOne({ email });
      if (existing) return res.status(409).json({ success: false, message: 'Email already registered' });
      const user = await User.create({ name, email, passwordHash: password, role });
      res.status(201).json({ success: true, data: user.toSafeObject() });
    } catch (err) { next(err); }
  }
);

// Toggle active status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(422).json({ success: false, message: 'Cannot deactivate yourself' });
    }
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, data: user.toSafeObject() });
  } catch (err) { next(err); }
});

// Update role
router.patch('/:id/role',
  [body('role').isIn(['ADMIN', 'TELLER', 'AUDITOR'])],
  validate,
  async (req, res, next) => {
    try {
      const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true }).select('-passwordHash');
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  }
);

module.exports = router;
