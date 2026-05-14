const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { report } = require('../controllers/paymentsController');

router.get('/report', auth, roles('admin'), report);

module.exports = router;
