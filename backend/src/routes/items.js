const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/items');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/report', ctrl.getItemsReport);
router.get('/report/:itemName', ctrl.getItemPartiesReport);
router.get('/autocomplete', ctrl.getItemNames);

module.exports = router;
