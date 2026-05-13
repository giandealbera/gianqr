const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { create, scan, getOne, getAll, getQR } = require('../controllers/ticketsController');

// Venta manual (cajero y admin)
router.post('/', auth, roles('admin', 'cajero'), create);

// Escaneo en puerta (portero y admin)
router.post('/scan', auth, roles('admin', 'portero'), scan);

// Consultas
router.get('/',      auth, roles('admin', 'cajero'), getAll);
router.get('/:id',   auth, getOne);
router.get('/:id/qr', auth, getQR);

module.exports = router;
