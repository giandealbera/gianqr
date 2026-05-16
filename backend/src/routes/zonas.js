const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { list, create, update, remove } = require('../controllers/zonasController');

// Lista accesible para admin + jefes (para asignar zona al crear vendedor / mostrar la propia)
router.get('/',       auth, roles('admin', 'jefe_publicas'), list);
router.post('/',      auth, roles('admin'), create);
router.put('/:id',    auth, roles('admin'), update);
router.delete('/:id', auth, roles('admin'), remove);

module.exports = router;
