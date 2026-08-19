const express = require('express');
const { asyncRouter } = require('../utils/asyncRouter');
const router  = asyncRouter(express.Router());
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { createCortesias } = require('../controllers/cortesiasController');

// owner puede emitir cortesias para SUS eventos (controller valida scope).
router.post('/', auth, roles('admin', 'owner'), createCortesias);

module.exports = router;
