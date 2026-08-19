const express = require('express');
const { asyncRouter } = require('../utils/asyncRouter');
const router  = asyncRouter(express.Router());
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { report, monthlyOverview } = require('../controllers/paymentsController');

router.get('/report',           auth, roles('admin'), report);
// owner ve solo los meses con actividad de SUS eventos (controller filtra).
router.get('/monthly-overview', auth, roles('admin', 'owner'), monthlyOverview);

module.exports = router;
