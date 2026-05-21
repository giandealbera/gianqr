const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { getTokens, createToken, deleteToken } = require('../controllers/scannerTokensController');

// owner ve y crea tokens solo para SUS eventos (controller verifica scope).
router.get('/',      auth, roles('admin', 'owner'), getTokens);
router.post('/',     auth, roles('admin', 'owner'), createToken);
router.delete('/:id', auth, roles('admin', 'owner'), deleteToken);

module.exports = router;
