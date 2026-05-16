const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { loginLimiter, magicLimiter } = require('../middleware/rateLimiters');
const { login, me, magicLogin } = require('../controllers/authController');

router.post('/login', loginLimiter, login);
router.get('/me', auth, me);
router.get('/magic/:token', magicLimiter, magicLogin);

module.exports = router;
