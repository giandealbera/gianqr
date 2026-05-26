// Helpers de sesion. createSession genera un jti, lo persiste, y devuelve
// el id para incluirlo en el JWT como claim `jti`. El middleware auth lo
// usa para validar que la sesion sigue activa.

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

function clientIp(req) {
  return req?.ip || (req?.headers?.['x-forwarded-for'] || '').split(',')[0]?.trim() || null;
}

async function createSession(req, userId) {
  const jti = uuidv4();
  try {
    await db.query(
      'INSERT INTO sessions (id, user_id, user_agent, ip) VALUES (?,?,?,?)',
      [jti, userId, (req?.headers?.['user-agent'] || '').slice(0, 500) || null, clientIp(req)]
    );
  } catch (err) {
    console.error('createSession failed:', err.message);
    // Si la INSERT falla, igual emitimos el token (graceful degradation).
    // El middleware acepta tokens sin jti (legacy path).
  }
  return jti;
}

async function revokeSession(sessionId) {
  await db.query('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL', [sessionId]);
}

async function revokeAllSessionsForUser(userId, exceptSessionId = null) {
  if (exceptSessionId) {
    await db.query(
      'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id != ? AND revoked_at IS NULL',
      [userId, exceptSessionId]
    );
  } else {
    await db.query(
      'UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
      [userId]
    );
  }
}

module.exports = { createSession, revokeSession, revokeAllSessionsForUser };
