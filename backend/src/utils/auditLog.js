// Helper de audit log — append-only, fire-and-forget.
//
// Filosofia:
//   - Loguear NUNCA debe romper la operación del caller. Si falla la INSERT,
//     loggeamos a stderr y seguimos: peor escenario es perder la traza, no
//     bloquear al usuario.
//   - Append-only: no se expone endpoint de update/delete. El cleanup por
//     antigüedad se hace via job o manualmente desde la DB.
//   - El detalle (details) se serializa como JSON corto. Nunca metas
//     password_hash, tokens completos, ni datos de tarjeta.
//
// Convenciones de acciones (codigo en MAYUSCULAS_CON_GUION_BAJO):
//   USER_CREATE, USER_UPDATE, USER_DEACTIVATE, USER_REACTIVATE
//   USER_PASSWORD_RESET     -- admin/owner reseteo la password de otro
//   USER_ROLE_CHANGE        -- detalle: { from, to }
//   USER_COMMISSION_CHANGE  -- detalle: { from, to }
//   USER_MAGIC_LINK         -- jefe/admin emitio un magic link
//   EVENT_CREATE, EVENT_UPDATE, EVENT_DELETE
//   EVENT_RESET             -- borra tickets del evento (accion peligrosa)
//   EVENT_OWNER_ADDED, EVENT_OWNER_REMOVED
//   TICKET_DELETE
//   AUTH_LOGIN_FAILED       -- opcional, ayuda a detectar credential stuffing

const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

function clientIp(req) {
  // trust proxy:1 esta seteado en server.js, asi req.ip ya viene resuelto.
  return req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null;
}

function safeStringify(obj) {
  try {
    const str = JSON.stringify(obj);
    return str.length > 4000 ? str.slice(0, 4000) + '…' : str;
  } catch {
    return null;
  }
}

async function logAudit(req, action, opts = {}) {
  const {
    resourceType = null,
    resourceId   = null,
    details      = null,
    actorOverride = null, // para acciones sin req.user (ej. login fallido)
  } = opts;
  try {
    const actor = actorOverride || req?.user || {};
    await db.query(
      `INSERT INTO audit_log
         (id, actor_user_id, actor_email, actor_role,
          action, resource_type, resource_id, details, ip, user_agent)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        uuidv4(),
        actor.id || null,
        actor.email || null,
        actor.role || null,
        action,
        resourceType,
        resourceId,
        details ? safeStringify(details) : null,
        clientIp(req),
        (req?.headers?.['user-agent'] || '').slice(0, 500) || null,
      ]
    );
  } catch (err) {
    // No bloqueamos la operacion del caller si falla el log
    console.error('audit_log insert failed:', err.message);
  }
}

module.exports = { logAudit };
