const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { createCortesias } = require('../controllers/cortesiasController');

// owner puede emitir cortesias para SUS eventos (controller valida scope).
router.post('/', auth, roles('admin', 'owner'), createCortesias);

module.exports = router;
