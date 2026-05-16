const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { loginLimiter, magicLimiter, forgotPasswordLimiter, resetPasswordLimiter } = require('../middleware/rateLimiters');
const { login, me, magicLogin, forgotPassword, resetPassword, changePassword } = require('../controllers/authController');

router.post('/login', loginLimiter, login);
router.get('/me', auth, me);
router.get('/magic/:token', magicLimiter, magicLogin);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password',  resetPasswordLimiter, resetPassword);
router.post('/change-password', auth, changePassword);

module.exports = router;
