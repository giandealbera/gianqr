const jwt = require('jsonwebtoken');
const db  = require('../config/database');

const auth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verificar si el usuario sigue activo en la base de datos
    const result = await db.query('SELECT is_active, password_changed_at FROM users WHERE id = ?', [decoded.id]);
    const user = result.rows[0];
    if (!user || user.is_active !== 1) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }

    // Invalidar tokens emitidos antes del ultimo cambio de contraseña.
    // decoded.iat es UNIX seconds. NULL = legacy (no enforcement).
    // SQLite devuelve "YYYY-MM-DD HH:MM:SS" en UTC; lo forzamos como UTC
    // agregando 'Z' (sino new Date lo interpreta como local timezone).
    if (user.password_changed_at) {
      const raw = String(user.password_changed_at);
      const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
      const pwdChangedSec = Math.floor(new Date(iso).getTime() / 1000);
      if (decoded.iat < pwdChangedSec) {
        return res.status(403).json({ error: 'Token inválido o expirado' });
      }
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
