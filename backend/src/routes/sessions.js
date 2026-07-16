const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { list, revoke, revokeOthers, logout } = require('../controllers/sessionsController');

router.get(   '/',              auth, list);
router.post(  '/logout',        auth, logout);
router.delete('/:id',           auth, revoke);
router.post(  '/revoke-others', auth, revokeOthers);

module.exports = router;
