const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { list } = require('../controllers/auditController');

router.get('/', auth, roles('admin', 'owner'), list);

module.exports = router;
