/**
 * Rate limiters por endpoint. Cada uno con su ventana y limite distintos
 * segun el riesgo (login brute-force, magic-token guess, public buy, etc.).
 *
 * Importante: para que el rate-limit lea la IP real detras de Railway/Cloudflare/Vercel,
 * el server.js setea app.set('trust proxy', 1). Sin eso todas las peticiones se ven
 * como del mismo IP y un atacante tumba a todos.
 */
const rateLimit = require('express-rate-limit');

const baseConfig = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
};

// Global: red de seguridad para todo /api/* — 500 req por IP cada 15 min
const globalLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Demasiadas solicitudes, esperá unos minutos' },
});

// Login: 5 intentos por IP en 15 min. No cuenta los exitosos, así un usuario
// que se loguea bien y sigue navegando no consume el cupo.
const loginLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos de login, esperá 15 minutos' },
});

// Magic token: 10 intentos por IP en 15 min. Los tokens son UUIDs (poco
// brute-forceables) pero igual ponemos un techo.
const magicLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos, esperá unos minutos' },
});

// Public ticket buy: 20/min por IP. Es alto a propósito — un comprador real
// puede retry varias veces si tiene mala conexión. Un bot que spamea cae igual.
const publicBuyLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Demasiadas solicitudes, esperá un momento' },
});

// Public recover: 10/15min por IP. Este endpoint permite enumerar compradores
// por nombre+apellido. Lo ajustamos bajo.
const publicRecoverLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiadas búsquedas, esperá unos minutos' },
});

// Public scan: 60/min por IP. Un portero escanea rapido pero un bot mucho mas.
const publicScanLimiter = rateLimit({
  ...baseConfig,
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Demasiados escaneos' },
});

module.exports = {
  globalLimiter,
  loginLimiter,
  magicLimiter,
  publicBuyLimiter,
  publicRecoverLimiter,
  publicScanLimiter,
};
