const express = require('express');
const { asyncRouter } = require('../utils/asyncRouter');
const router  = asyncRouter(express.Router());
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { listPublicas, getPublicaDetail, registrarPago, eliminarPago } = require('../controllers/rendicionesController');

router.get('/',             auth, roles('admin', 'owner'), listPublicas);
router.get('/:promotorId',  auth, roles('admin', 'owner'), getPublicaDetail);
router.post('/',            auth, roles('admin', 'owner'), registrarPago);
router.delete('/:id',       auth, roles('admin', 'owner'), eliminarPago);

module.exports = router;
