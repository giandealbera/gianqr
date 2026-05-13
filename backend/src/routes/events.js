const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { getAll, getOne, create, update, stats, getVenues } = require('../controllers/eventsController');

router.get('/venues',  auth, getVenues);
router.get('/',        getAll);              // público para la página de compra
router.get('/:id',     getOne);             // público
router.get('/:id/stats', auth, roles('admin'), stats);
router.post('/',       auth, roles('admin'), create);
router.put('/:id',     auth, roles('admin'), update);

module.exports = router;
