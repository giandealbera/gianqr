const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const {
  getAll, getOne, create, update, stats, history, resetEvent, cloneEvent,
  stopSales, resumeSales, buyerStats, exportData,
  getTicketTypes, addTicketType, updateTicketType, toggleTicketType,
  getTicketTypeSellers, setTicketTypeSellers,
  getOwners, addOwner, removeOwner,
} = require('../controllers/eventsController');

router.get('/history', auth, roles('admin', 'owner'), history);

// owner puede ver y editar sus eventos
router.get('/',        auth, getAll);
router.get('/:id',     auth, getOne);
router.get('/:id/stats', auth, roles('admin', 'owner'), stats);
// Estadísticas demográficas del público (edad/localidad/email).
router.get('/:id/buyer-stats', auth, roles('admin', 'owner'), buyerStats);
// Export completo (xlsx). SOLO owner del evento; el controller exige ademas
// que aparezca en event_owners. Admins reciben 403 desde el middleware roles().
router.get('/:id/export-data', auth, roles('owner'), exportData);
// Owner puede crear sus propios eventos (se auto-asigna como dueño).
router.post('/',       auth, roles('admin', 'owner'), create);
// Clonar evento (copia ticket_types y dueños del original).
router.post('/:id/clone', auth, roles('admin', 'owner'), cloneEvent);
// Corte manual de venta (sold out). El evento sigue accesible para rendir.
router.post('/:id/stop-sales',   auth, roles('admin', 'owner'), stopSales);
router.post('/:id/resume-sales', auth, roles('admin', 'owner'), resumeSales);
router.post('/:id/reset', auth, roles('admin', 'owner'), resetEvent);
router.put('/:id',     auth, roles('admin', 'owner'), update);

// Gestión de tipos de entrada (owner con verificación de ownership en el controller)
router.get('/:id/ticket-types',                auth, roles('admin', 'owner'), getTicketTypes);
router.post('/:id/ticket-types',               auth, roles('admin', 'owner'), addTicketType);
router.put('/:id/ticket-types/:ttId',          auth, roles('admin', 'owner'), updateTicketType);
router.patch('/:id/ticket-types/:ttId/toggle', auth, roles('admin', 'owner'), toggleTicketType);

// Permisos por tipo: quien puede vender este ticket_type. GET para listar,
// PUT para reemplazar. Solo admin/owner gestionan; jefe/vendedor solo ven
// indirectamente via el filtrado de getTicketTypes.
router.get('/:id/ticket-types/:ttId/sellers', auth, roles('admin', 'owner'), getTicketTypeSellers);
router.put('/:id/ticket-types/:ttId/sellers', auth, roles('admin', 'owner'), setTicketTypeSellers);

// Gestión de dueños del evento (solo admin)
router.get('/:id/owners',         auth, roles('admin'), getOwners);
router.post('/:id/owners',        auth, roles('admin'), addOwner);
router.delete('/:id/owners/:uid', auth, roles('admin'), removeOwner);

module.exports = router;
