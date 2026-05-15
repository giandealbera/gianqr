const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { createCortesias } = require('../controllers/cortesiasController');

router.post('/', auth, roles('admin'), createCortesias);

module.exports = router;
