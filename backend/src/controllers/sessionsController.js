// Endpoints para que un usuario vea y revoque sus propias sesiones.
// No exponemos un viewer global ni cross-user — cada user solo ve las suyas.

const db = require('../config/database');
const { revokeSession, revokeAllSessionsForUser } = require('../utils/sessions');
const { logAudit } = require('../utils/auditLog');

// GET /api/sessions — lista las sesiones del usuario logueado
const list = async (req, res) => {
  try {
    const r = await db.query(
      `SELECT id, user_agent, ip, created_at, last_seen_at, revoked_at
       FROM sessions
       WHERE user_id = ?
       ORDER BY COALESCE(last_seen_at, created_at) DESC
       LIMIT 50`,
      [req.user.id]
    );
    const rows = r.rows.map(s => ({
      ...s,
      is_current: s.id === req.user.jti,
      is_active:  !s.revoked_at,
    }));
    res.json({ rows });
  } catch (err) {
    console.error('sessions list error:', err);
    res.status(500).json({ error: 'Error al obtener sesiones' });
  }
};

// DELETE /api/sessions/:id — revoca una sesion del usuario logueado.
const revoke = async (req, res) => {
  const { id } = req.params;
  try {
    // Verificar ownership: el usuario solo puede revocar SUS sesiones.
    const r = await db.query('SELECT user_id FROM sessions WHERE id = ?', [id]);
    const sess = r.rows[0];
    if (!sess || sess.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }
    await revokeSession(id);
    logAudit(req, 'SESSION_REVOKED', { resourceType: 'session', resourceId: id });
    res.json({ message: 'Sesión revocada' });
  } catch (err) {
    console.error('sessions revoke error:', err);
    res.status(500).json({ error: 'Error al revocar sesión' });
  }
};

// POST /api/sessions/revoke-others — revoca todas las sesiones del usuario
// excepto la actual. Util si sospechas que alguien mas tiene tu sesion.
const revokeOthers = async (req, res) => {
  try {
    if (!req.user.jti) {
      // Token legacy sin jti: no podemos "preservar la actual". El cliente
      // debe relogear primero para conseguir un token con jti, o usar
      // change-password como kill switch global.
      return res.status(400).json({ error: 'Token legacy sin jti. Reloguea para obtener uno nuevo.' });
    }
    await revokeAllSessionsForUser(req.user.id, req.user.jti);
    logAudit(req, 'SESSION_REVOKE_OTHERS', { resourceType: 'user', resourceId: req.user.id });
    res.json({ message: 'Otras sesiones revocadas' });
  } catch (err) {
    console.error('sessions revoke-others error:', err);
    res.status(500).json({ error: 'Error al revocar sesiones' });
  }
};

module.exports = { list, revoke, revokeOthers };
