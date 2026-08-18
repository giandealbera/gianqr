const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { loginLimiter, magicLimiter, forgotPasswordLimiter, resetPasswordLimiter } = require('../middleware/rateLimiters');
const { login, me, magicLogin, forgotPassword, forgotPasswordByPhone, resetPassword, checkResetToken, changePassword, verifyTwoFactor } = require('../controllers/authController');
const { setup: tfaSetup, enable: tfaEnable, disable: tfaDisable, regenerateRecoveryCodes, status: tfaStatus } = require('../controllers/tfaController');

router.post('/login', loginLimiter, login);
router.get('/me', auth, me);
router.get('/magic/:token', magicLimiter, magicLogin);
router.post('/forgot-password',       forgotPasswordLimiter, forgotPassword);
router.post('/forgot-password-phone', forgotPasswordLimiter, forgotPasswordByPhone);
// Validacion del link ANTES de mostrar el formulario. Mismo limiter que el
// reset: el token es de 256 bits, pero igual le ponemos techo a la sonda.
router.get( '/reset-password/:token', resetPasswordLimiter, checkResetToken);
router.post('/reset-password',  resetPasswordLimiter, resetPassword);
router.post('/change-password', auth, changePassword);

// 2FA / TOTP. Todos requieren sesion (auth), excepto verify que usa
// partial_token. verify queda detras del loginLimiter (mismo bucket que
// login: 5 intentos por IP por 15min). Asi un atacante con la password
// del usuario igual cae al pin del 2FA.
router.post('/2fa/verify',              loginLimiter, verifyTwoFactor);
router.get( '/2fa/status',              auth, tfaStatus);
router.get( '/2fa/setup',               auth, tfaSetup);
router.post('/2fa/enable',              auth, tfaEnable);
router.post('/2fa/disable',             auth, tfaDisable);
router.post('/2fa/recovery/regenerate', auth, regenerateRecoveryCodes);

module.exports = router;
