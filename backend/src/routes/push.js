const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { getPublicKey, subscribe, unsubscribe, sendTest } = require('../controllers/pushController');

// La public key NO requiere auth — el frontend la necesita para subscribirse
// incluso antes de tener un user_id. No es secreto, solo identifica al servidor.
router.get('/public-key', getPublicKey);

// El resto: cualquier usuario logueado.
router.post('/subscribe',   auth, subscribe);
router.post('/unsubscribe', auth, unsubscribe);
router.post('/test',        auth, sendTest);

module.exports = router;
