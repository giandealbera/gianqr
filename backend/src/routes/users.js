const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { getAll, create, update, deactivate, getPromoterSales, getMyPromoterSales } = require('../controllers/usersController');

// Ventas de promotores (admin)
router.get('/promoter-sales', auth, roles('admin'), getPromoterSales);

// Mis ventas (promotor)
router.get('/my-sales', auth, roles('admin', 'promotor'), getMyPromoterSales);

router.get('/',       auth, roles('admin'), getAll);
router.post('/',      auth, roles('admin'), create);
router.put('/:id',    auth, roles('admin'), update);
router.delete('/:id', auth, roles('admin'), deactivate);

module.exports = router;
