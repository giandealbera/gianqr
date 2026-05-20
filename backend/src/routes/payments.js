const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { report, monthlyOverview } = require('../controllers/paymentsController');

router.get('/report',           auth, roles('admin'), report);
router.get('/monthly-overview', auth, roles('admin'), monthlyOverview);

module.exports = router;
