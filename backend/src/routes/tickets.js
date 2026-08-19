const express = require('express');
const { asyncRouter } = require('../utils/asyncRouter');
const router  = asyncRouter(express.Router());
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { create, preSell, scan, getOne, getAll, getQR, remove } = require('../controllers/ticketsController');

// Venta manual (admin, jefe_publicas y vendedor)
router.post('/', auth, roles('admin', 'jefe_publicas', 'vendedor'), create);

// Pre-venta: reserva N entradas a nombre "Pendiente" y descuenta cupo ya.
// El comprador completa nombre/apellido despues vía link publico (?tickets=).
// owner puede usarlo: el controller valida que el evento sea suyo (event_owners).
router.post('/pre-sell', auth, roles('admin', 'jefe_publicas', 'vendedor', 'owner'), preSell);

// Escaneo en puerta desde el panel. Admin y owner: la ruta /escaner del
// frontend ya se le mostraba al owner, pero el endpoint exigia admin, asi
// que al owner cada escaneo le respondia "Se requiere rol: admin".
// El controller valida que el owner solo pueda escanear SUS eventos.
// El resto del staff usa los links publicos /scan/:token.
router.post('/scan', auth, roles('admin', 'owner'), scan);

// Consultas — admin y owner (el controller verifica scope de ownership).
// Para evitar IDOR, owner solo ve sus propios eventos.
router.get('/',       auth, roles('admin', 'owner'), getAll);
router.get('/:id',    auth, roles('admin', 'owner'), getOne);
router.get('/:id/qr', auth, roles('admin', 'owner'), getQR);

// Eliminar (admin y owner — el controller verifica que el owner sea dueño
// del evento del ticket, y que el admin lo tenga en su arbol).
router.delete('/:id', auth, roles('admin', 'owner'), remove);

module.exports = router;
