const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { create, preSell, scan, getOne, getAll, getQR, remove } = require('../controllers/ticketsController');

// Venta manual (admin, jefe_publicas y vendedor)
router.post('/', auth, roles('admin', 'jefe_publicas', 'vendedor'), create);

// Pre-venta: reserva N entradas a nombre "Pendiente" y descuenta cupo ya.
// El comprador completa nombre/apellido despues vía link publico (?tickets=).
// owner puede usarlo: el controller valida que el evento sea suyo (event_owners).
router.post('/pre-sell', auth, roles('admin', 'jefe_publicas', 'vendedor', 'owner'), preSell);

// Escaneo en puerta (solo admin — los demás usan links públicos /scan/:token)
router.post('/scan', auth, roles('admin'), scan);

// Consultas — admin y owner (el controller verifica scope de ownership).
// Para evitar IDOR, owner solo ve sus propios eventos.
router.get('/',       auth, roles('admin', 'owner'), getAll);
router.get('/:id',    auth, roles('admin', 'owner'), getOne);
router.get('/:id/qr', auth, roles('admin', 'owner'), getQR);

// Eliminar (solo admin)
router.delete('/:id', auth, roles('admin'), remove);

module.exports = router;
