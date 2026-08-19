const express = require('express');
const { asyncRouter } = require('../utils/asyncRouter');
const router  = asyncRouter(express.Router());
const { publicScanLimiter } = require('../middleware/rateLimiters');
const { getScannerInfo, publicScan } = require('../controllers/scannerTokensController');

router.get('/:token',  getScannerInfo);
router.post('/:token', publicScanLimiter, publicScan);

module.exports = router;
