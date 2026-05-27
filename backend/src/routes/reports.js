const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reports');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/dashboard',      ctrl.dashboard);
router.get('/trial-balance',  ctrl.trialBalance);
router.get('/reconciliation', ctrl.reconciliation);
router.get('/daily-totals',   ctrl.dailyTotals);
router.get('/profit-summary', ctrl.profitSummary);

module.exports = router;
