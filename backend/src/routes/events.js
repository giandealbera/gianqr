const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const {
  getAll, getOne, create, update, stats, history, resetEvent,
  getVenues, getTicketTypes, addTicketType, updateTicketType, toggleTicketType,
  getOwners, addOwner, removeOwner,
} = require('../controllers/eventsController');

router.get('/venues',  auth, getVenues);
router.get('/history', auth, roles('admin'), history);

// owner puede ver y editar sus eventos
router.get('/',        auth, getAll);
router.get('/:id',     auth, getOne);
router.get('/:id/stats', auth, roles('admin', 'owner'), stats);
router.post('/',       auth, roles('admin'), create);
router.post('/:id/reset', auth, roles('admin'), resetEvent);
router.put('/:id',     auth, roles('admin', 'owner'), update);

// Gestión de tipos de entrada (owner con verificación de ownership en el controller)
router.get('/:id/ticket-types',                auth, roles('admin', 'owner'), getTicketTypes);
router.post('/:id/ticket-types',               auth, roles('admin', 'owner'), addTicketType);
router.put('/:id/ticket-types/:ttId',          auth, roles('admin', 'owner'), updateTicketType);
router.patch('/:id/ticket-types/:ttId/toggle', auth, roles('admin', 'owner'), toggleTicketType);

// Gestión de dueños del evento (solo admin)
router.get('/:id/owners',         auth, roles('admin'), getOwners);
router.post('/:id/owners',        auth, roles('admin'), addOwner);
router.delete('/:id/owners/:uid', auth, roles('admin'), removeOwner);

module.exports = router;
