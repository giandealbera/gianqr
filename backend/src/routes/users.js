const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { getAll, create, update, deactivate } = require('../controllers/usersController');

router.get('/',       auth, roles('admin'), getAll);
router.post('/',      auth, roles('admin'), create);
router.put('/:id',    auth, roles('admin'), update);
router.delete('/:id', auth, roles('admin'), deactivate);

module.exports = router;
