const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { createMPPreference, mpWebhook, report } = require('../controllers/paymentsController');

// MercadoPago
router.post('/mp/create-preference', createMPPreference); // público (compra online)
router.post('/mp/webhook', mpWebhook);                     // webhook de MP

// Reporte de pagos (solo admin)
router.get('/report', auth, roles('admin'), report);

module.exports = router;
