const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { listPublicas, getPublicaDetail, registrarPago, eliminarPago } = require('../controllers/rendicionesController');

router.get('/',             auth, roles('admin'), listPublicas);
router.get('/:promotorId',  auth, roles('admin'), getPublicaDetail);
router.post('/',            auth, roles('admin'), registrarPago);
router.delete('/:id',       auth, roles('admin'), eliminarPago);

module.exports = router;
