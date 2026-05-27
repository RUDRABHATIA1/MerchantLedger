const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/manufacturing');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Recipes
router.get('/recipes', ctrl.listRecipes);
router.post('/recipes', authorize('ADMIN', 'TELLER'), ctrl.createRecipe);
router.put('/recipes/:id', authorize('ADMIN', 'TELLER'), ctrl.updateRecipe);
router.delete('/recipes/:id', authorize('ADMIN'), ctrl.deleteRecipe);

// Expenses
router.get('/expenses', ctrl.listExpenses);
router.post('/expenses', authorize('ADMIN', 'TELLER'), ctrl.createExpense);
router.delete('/expenses/:id', authorize('ADMIN'), ctrl.deleteExpense);

// Runs
router.post('/runs', ctrl.createRun);
router.get('/runs', ctrl.listRuns);

// Utility endpoints
router.get('/summary', ctrl.summary);
router.post('/preview', ctrl.preview);

// CRUD for manufacturing runs
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', authorize('ADMIN', 'TELLER'), ctrl.create);
router.put('/:id', authorize('ADMIN', 'TELLER'), ctrl.update);
router.delete('/:id', authorize('ADMIN'), ctrl.remove);

module.exports = router;
