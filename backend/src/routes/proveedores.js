const express = require('express');
const { asyncRouter } = require('../utils/asyncRouter');
const router  = asyncRouter(express.Router());
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { list, create, update, remove } = require('../controllers/proveedoresController');

router.get('/',    auth, roles('admin', 'owner'), list);
router.post('/',   auth, roles('admin', 'owner'), create);
router.put('/:id', auth, roles('admin', 'owner'), update);
router.delete('/:id', auth, roles('admin', 'owner'), remove);

module.exports = router;
