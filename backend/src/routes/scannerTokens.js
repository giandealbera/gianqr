const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { getTokens, createToken, deleteToken } = require('../controllers/scannerTokensController');

router.get('/',      auth, roles('admin'), getTokens);
router.post('/',     auth, roles('admin'), createToken);
router.delete('/:id', auth, roles('admin'), deleteToken);

module.exports = router;
