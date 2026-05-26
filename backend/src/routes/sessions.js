const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { list, revoke, revokeOthers } = require('../controllers/sessionsController');

router.get(   '/',              auth, list);
router.delete('/:id',           auth, revoke);
router.post(  '/revoke-others', auth, revokeOthers);

module.exports = router;
