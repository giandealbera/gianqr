// Endpoint de consulta del audit log. Solo admin y owner (con scope a su
// propio arbol). Lectura paginada, soporta filtros por accion, actor o
// resource_id. Append-only desde la UI: no exponemos delete ni update.

const db = require('../config/database');
const { adminCanAccessUser } = require('../utils/scope');

// Acepta "YYYY-MM-DD" o ISO completo. Devuelve string normalizado en formato
// que entienden tanto SQLite (TEXT comparable) como PG (timestamp).
// Rechaza inputs invalidos sin tirar 500 — el cliente ve 400 limpio.
function parseDateBoundary(str, endOfDay = false) {
  if (!str) return null;
  // Si viene solo YYYY-MM-DD, completamos hora.
  const onlyDate = /^\d{4}-\d{2}-\d{2}$/.test(str);
  const candidate = onlyDate
    ? (endOfDay ? `${str} 23:59:59` : `${str} 00:00:00`)
    : str;
  const d = new Date(candidate);
  if (isNaN(d.getTime())) return null;
  return candidate;
}

// GET /api/audit-log?action=USER_PASSWORD_RESET&actor_user_id=...&limit=100&offset=0
const list = async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const { action, actor_user_id, resource_id, resource_type, from, to } = req.query;

    const where  = ['1=1'];
    const params = [];

    if (action)         { where.push('action = ?');        params.push(action); }
    if (actor_user_id)  { where.push('actor_user_id = ?'); params.push(actor_user_id); }
    if (resource_id)    { where.push('resource_id = ?');   params.push(resource_id); }
    if (resource_type)  { where.push('resource_type = ?'); params.push(resource_type); }

    // Validar fechas antes de pasarlas a la query. Antes un string "tomorrow"
    // o "2025-13-99" tiraba 500 en PG o filtraba mal en SQLite. Ahora 400 limpio.
    if (from) {
      const f = parseDateBoundary(from, false);
      if (!f) return res.status(400).json({ error: 'from inválida (esperado YYYY-MM-DD)' });
      where.push('created_at >= ?'); params.push(f);
    }
    if (to) {
      const t = parseDateBoundary(to, true);
      if (!t) return res.status(400).json({ error: 'to inválida (esperado YYYY-MM-DD)' });
      where.push('created_at <= ?'); params.push(t);
    }

    // Scope multi-tenant:
    //   - admin: solo entries cuyo actor esta en su arbol.
    //   - owner: solo entries cuyo actor es el o su staff.
    // No filtramos por target porque para una accion como USER_PASSWORD_RESET
    // el target puede ser un user de otro tenant que el admin tomo over
    // (que es exactamente el caso que queremos detectar via audit).
    if (req.user?.role === 'admin') {
      where.push(`(
        actor_user_id = ?
        OR actor_user_id IN (SELECT id FROM users WHERE created_by = ?)
        OR actor_user_id IN (
          SELECT u2.id FROM users u2
          JOIN users u1 ON u1.id = u2.created_by
          WHERE u1.created_by = ?
        )
        OR actor_user_id IN (
          SELECT u3.id FROM users u3
          JOIN users u2 ON u2.id = u3.created_by
          JOIN users u1 ON u1.id = u2.created_by
          WHERE u1.created_by = ?
        )
      )`);
      params.push(req.user.id, req.user.id, req.user.id, req.user.id);
    } else if (req.user?.role === 'owner') {
      where.push(`(
        actor_user_id = ?
        OR actor_user_id IN (SELECT id FROM users WHERE created_by = ?)
        OR actor_user_id IN (
          SELECT u2.id FROM users u2
          JOIN users u1 ON u1.id = u2.created_by
          WHERE u1.created_by = ?
        )
      )`);
      params.push(req.user.id, req.user.id, req.user.id);
    } else {
      // No deberia pasar (route esta restringida a admin/owner), pero por
      // las dudas devolvemos vacio en lugar de 403 (defensa en profundidad).
      return res.json({ rows: [], total: 0 });
    }

    const whereSql = 'WHERE ' + where.join(' AND ');

    const countRow = await db.query(`SELECT COUNT(*) AS total FROM audit_log ${whereSql}`, params);
    const total = parseInt(countRow.rows[0]?.total || 0, 10);

    const result = await db.query(
      `SELECT id, actor_user_id, actor_email, actor_role,
              action, resource_type, resource_id, details, ip, user_agent, created_at
       FROM audit_log
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Parsear details JSON para que el cliente no tenga que hacerlo
    const rows = result.rows.map(r => {
      let parsed = null;
      try { parsed = r.details ? JSON.parse(r.details) : null; } catch { parsed = r.details; }
      return { ...r, details: parsed };
    });

    res.json({ rows, total, limit, offset });
  } catch (err) {
    console.error('audit list error:', err);
    res.status(500).json({ error: 'Error al consultar audit log' });
  }
};

module.exports = { list };
