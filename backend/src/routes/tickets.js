const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { create, preSell, scan, getOne, getAll, getQR, remove } = require('../controllers/ticketsController');

// Venta manual (admin, jefe_publicas y vendedor)
router.post('/', auth, roles('admin', 'jefe_publicas', 'vendedor'), create);

// Pre-venta: reserva N entradas a nombre "Pendiente" y descuenta cupo ya.
// El comprador completa nombre/apellido despues vía link publico (?tickets=).
router.post('/pre-sell', auth, roles('admin', 'jefe_publicas', 'vendedor'), preSell);

// Escaneo en puerta (solo admin — los demás usan links públicos /scan/:token)
router.post('/scan', auth, roles('admin'), scan);

// Consultas — solo admin. Para evitar IDOR (cualquier user autenticado
// veia datos PII y QR descargable de cualquier ticket enumerando UUIDs).
router.get('/',       auth, roles('admin'), getAll);
router.get('/:id',    auth, roles('admin'), getOne);
router.get('/:id/qr', auth, roles('admin'), getQR);

// Eliminar (solo admin)
router.delete('/:id', auth, roles('admin'), remove);

module.exports = router;
