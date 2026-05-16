const express = require('express');
const router  = express.Router();
const { publicScanLimiter } = require('../middleware/rateLimiters');
const { getScannerInfo, publicScan } = require('../controllers/scannerTokensController');

router.get('/:token',  getScannerInfo);
router.post('/:token', publicScanLimiter, publicScan);

module.exports = router;
