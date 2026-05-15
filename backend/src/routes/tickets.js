const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { create, scan, getOne, getAll, getQR, remove } = require('../controllers/ticketsController');

// Venta manual (cajero, admin, promotor, jefe_publicas y vendedor)
router.post('/', auth, roles('admin', 'cajero', 'promotor', 'jefe_publicas', 'vendedor'), create);

// Escaneo en puerta (solo admin — los demás usan links públicos /scan/:token)
router.post('/scan', auth, roles('admin'), scan);

// Consultas
router.get('/',      auth, roles('admin', 'cajero'), getAll);
router.get('/:id',   auth, getOne);
router.get('/:id/qr', auth, getQR);

// Eliminar (solo admin)
router.delete('/:id', auth, roles('admin'), remove);

module.exports = router;
