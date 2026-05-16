const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { getAll, getOne, create, update, stats, history, resetEvent, getVenues, getTicketTypes, addTicketType, updateTicketType, toggleTicketType } = require('../controllers/eventsController');

router.get('/venues',  auth, getVenues);
router.get('/history', auth, roles('admin'), history);
router.get('/',        getAll);
router.get('/:id',     getOne);
router.get('/:id/stats', auth, roles('admin'), stats);
router.post('/',       auth, roles('admin'), create);
router.post('/:id/reset', auth, roles('admin'), resetEvent);
router.put('/:id',     auth, roles('admin'), update);

// Gestión de tipos de entrada
router.get('/:id/ticket-types',              auth, getTicketTypes);
router.post('/:id/ticket-types',             auth, roles('admin'), addTicketType);
router.put('/:id/ticket-types/:ttId',        auth, roles('admin'), updateTicketType);
router.patch('/:id/ticket-types/:ttId/toggle', auth, roles('admin'), toggleTicketType);

module.exports = router;
