const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { login, me, magicLogin } = require('../controllers/authController');

router.post('/login', login);
router.get('/me', auth, me);
router.get('/magic/:token', magicLogin);

module.exports = router;
