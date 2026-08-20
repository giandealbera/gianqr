// Helpers de scope multi-tenant para SaaS.
// Modelo de jerarquia: admin (root) -> owner -> jefe_publicas -> vendedor.
// Cada usuario tiene `created_by` apuntando al usuario que lo creó.
// Cada evento tiene `created_by` (admin) y opcionalmente `event_owners`
// (owners asignados al evento).
//
// Regla central: un admin SOLO puede leer/mutar recursos que pertenecen a
// SU propia árbol de usuarios. Antes de estos helpers, los controllers
// chequeaban solo `role==='owner'` y dejaban a un admin operar sobre
// recursos de cualquier otro admin del mismo despliegue.

const db = require('../config/database');

// adminCanAccessEvent(adminId, eventId)
// Un admin puede acceder a un evento si:
//   - El evento fue creado por él (events.created_by = adminId), o
//   - El evento tiene asignado un owner que fue creado por él
//     (event_owners.user_id IN owners-creados-por-adminId).
async function adminCanAccessEvent(adminId, eventId) {
  if (!adminId || !eventId) return false;
  const r = await db.query(
    `SELECT 1 FROM events e
     WHERE e.id = ?
       AND (
         e.created_by = ?
         OR e.id IN (
           SELECT eo.event_id FROM event_owners eo
           JOIN users u ON u.id = eo.user_id
           WHERE u.created_by = ?
         )
       )
     LIMIT 1`,
    [eventId, adminId, adminId]
  );
  return r.rows.length > 0;
}

// adminCanAccessUser(adminId, targetUserId)
// Un admin puede acceder a un usuario si:
//   - Es él mismo, o
//   - El user está en su árbol (sube por created_by hasta encontrarlo).
//   - Limitamos la profundidad a 3 hops (vendedor->jefe->owner->admin).
async function adminCanAccessUser(adminId, targetUserId) {
  if (!adminId || !targetUserId) return false;
  if (String(adminId) === String(targetUserId)) return true;
  let cur = targetUserId;
  for (let i = 0; i < 4; i++) {
    const r = await db.query('SELECT created_by FROM users WHERE id = ?', [cur]);
    if (!r.rows[0]) return false;
    const cb = r.rows[0].created_by;
    if (!cb) return false; // llegamos a un root sin matchear
    if (String(cb) === String(adminId)) return true;
    cur = cb;
  }
  return false;
}

// resolveOwnerScopeForUser(user)
// Para jefe/vendedor: devuelve el owner.id al que pertenecen, subiendo
// por created_by. Devuelve null si no se puede resolver.
//
// Casuistica que debe soportar:
//   - jefe_publicas:  creado por owner -> jefe.created_by = owner.id
//   - vendedor (jefe):  vendedor.created_by = jefe.id, jefe.created_by = owner.id
//   - vendedor (directo):  vendedor.created_by = owner.id (owner los crea
//     directo desde /admin/usuarios sin pasar por un jefe).
//
// Antes este helper asumia que un vendedor SIEMPRE colgaba de un jefe, asi
// que para un vendedor creado directo por owner subia 2 niveles y devolvia
// admin.id (mal). Bug: el vendedor no veia ningun evento del owner.
//
// Ahora miramos el ROL del padre para decidir si paramos o seguimos subiendo.
async function resolveOwnerScopeForUser(userId) {
  const r = await db.query('SELECT role, created_by FROM users WHERE id = ?', [userId]);
  const u = r.rows[0];
  if (!u) return null;
  if (u.role === 'owner') return userId;
  if (u.role === 'jefe_publicas') return u.created_by || null;
  if (u.role === 'vendedor' && u.created_by) {
    // Mirar el rol del padre directo
    const parent = await db.query('SELECT role, created_by FROM users WHERE id = ?', [u.created_by]);
    const p = parent.rows[0];
    if (!p) return null;
    if (p.role === 'owner') return u.created_by;          // padre es owner: ya estamos
    if (p.role === 'jefe_publicas') return p.created_by || null;  // padre es jefe: subir uno mas
    // Padre con rol inesperado (admin, vendedor): no resoluble.
    return null;
  }
  return null;
}

// ownerHasEvent(ownerId, eventId) — el owner figura como dueño del evento.
// Un evento puede tener VARIOS dueños (event_owners): asi funcionan los
// eventos conjuntos, donde el dueño de otro boliche entra como colaborador
// solo a ese evento y no al resto de los del organizador.
async function ownerHasEvent(ownerId, eventId) {
  if (!ownerId || !eventId) return false;
  const r = await db.query(
    'SELECT 1 FROM event_owners WHERE event_id = ? AND user_id = ? LIMIT 1',
    [eventId, ownerId]
  );
  return r.rows.length > 0;
}

/**
 * userCanAccessEvent(user, eventId) — LA respuesta a "¿este usuario puede
 * tocar este evento?", para todos los roles y en un solo lugar.
 *
 *   admin    -> solo eventos de su arbol
 *   owner    -> solo donde figura en event_owners (propio o como colaborador)
 *   jefe /
 *   vendedor -> solo eventos del owner al que pertenecen
 *
 * Existe porque la comprobacion estaba repetida y con huecos: el camino de
 * venta (POST /tickets y /tickets/pre-sell) no la hacia, y un vendedor del
 * dueño A podia vender entradas en el evento del dueño B mandando su
 * event_id a mano. Verificado antes de arreglarlo: devolvia 201.
 */
async function userCanAccessEvent(user, eventId) {
  const rol = user?.role;
  if (!rol || !eventId) return false;
  if (rol === 'admin')  return adminCanAccessEvent(user.id, eventId);
  if (rol === 'owner')  return ownerHasEvent(user.id, eventId);
  if (rol === 'jefe_publicas' || rol === 'vendedor') {
    const ownerId = await resolveOwnerScopeForUser(user.id);
    return !!ownerId && ownerHasEvent(ownerId, eventId);
  }
  return false;
}

module.exports = {
  adminCanAccessEvent,
  adminCanAccessUser,
  resolveOwnerScopeForUser,
  ownerHasEvent,
  userCanAccessEvent,
};
