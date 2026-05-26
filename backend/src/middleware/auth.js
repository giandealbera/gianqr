const jwt = require('jsonwebtoken');
const db  = require('../config/database');

// Cada 60s aprox actualizamos last_seen_at. Limita writes en endpoints
// chatos como /auth/me corriendo en background.
const LAST_SEEN_THROTTLE_SEC = 60;

const auth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Antes haciamos 2 queries (users + sessions). Ahora una sola con LEFT
    // JOIN: tokens sin jti devuelven session_* en NULL (que ignoramos).
    // Con esto bajamos de 2 round-trips a 1 en TODA request autenticada.
    let row;
    if (decoded.jti) {
      const result = await db.query(
        `SELECT u.is_active, u.password_changed_at,
                s.id AS session_id, s.revoked_at AS session_revoked_at, s.last_seen_at AS session_last_seen
         FROM users u
         LEFT JOIN sessions s ON s.id = ?
         WHERE u.id = ?`,
        [decoded.jti, decoded.id]
      );
      row = result.rows[0];
    } else {
      const result = await db.query(
        'SELECT is_active, password_changed_at FROM users WHERE id = ?',
        [decoded.id]
      );
      row = result.rows[0];
    }

    if (!row || row.is_active !== 1) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }

    // Invalidar tokens emitidos antes del ultimo cambio de contraseña.
    // decoded.iat es UNIX seconds. NULL = legacy (no enforcement).
    // SQLite devuelve "YYYY-MM-DD HH:MM:SS" en UTC; lo forzamos como UTC
    // agregando 'Z' (sino new Date lo interpreta como local timezone).
    if (row.password_changed_at) {
      const raw = String(row.password_changed_at);
      const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
      const pwdChangedSec = Math.floor(new Date(iso).getTime() / 1000);
      if (decoded.iat < pwdChangedSec) {
        return res.status(403).json({ error: 'Token inválido o expirado' });
      }
    }

    // Validacion de sesion (jti). Tokens legacy sin jti siguen valiendo
    // hasta su exp natural — el reset de password los mata via
    // password_changed_at.
    if (decoded.jti) {
      if (!row.session_id || row.session_revoked_at) {
        return res.status(403).json({ error: 'Sesión revocada' });
      }
      // Throttle: solo escribimos last_seen_at si paso mas de N segundos.
      // No bloqueamos la request si falla.
      try {
        const last = row.session_last_seen ? new Date(String(row.session_last_seen).replace(' ', 'T') + 'Z').getTime() : 0;
        if (Date.now() - last > LAST_SEEN_THROTTLE_SEC * 1000) {
          db.query('UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?', [decoded.jti])
            .catch(() => { /* no-op, no es critico */ });
        }
      } catch { /* no-op */ }
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    next(err);
  }
};

module.exports = auth;
