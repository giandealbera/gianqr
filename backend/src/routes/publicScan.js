const express = require('express');
const router  = express.Router();
const { getScannerInfo, publicScan } = require('../controllers/scannerTokensController');

router.get('/:token',  getScannerInfo);
router.post('/:token', publicScan);

module.exports = router;
