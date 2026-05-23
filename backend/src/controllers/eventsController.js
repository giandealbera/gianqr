const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { adminCanAccessEvent, resolveOwnerScopeForUser } = require('../utils/scope');

// Helper: verifica si un owner tiene acceso a un evento
async function ownerHasEvent(userId, eventId) {
  const r = await db.query(
    'SELECT 1 FROM event_owners WHERE user_id = ? AND event_id = ?',
    [userId, eventId]
  );
  return r.rows.length > 0;
}

// Guard canónica de acceso a un evento por id. Si el user no tiene acceso,
// responde 403 y devuelve false; el caller debe `return` si false.
// Cubre TODOS los roles: admin (solo eventos de su árbol), owner (solo los
// asignados), jefe/vendedor (solo los del owner al que pertenecen).
async function guardEventAccess(req, res, eventId) {
  const role = req.user?.role;
  if (!role || !eventId) {
    res.status(403).json({ error: 'Sin acceso a este evento' });
    return false;
  }
  let ok = false;
  if (role === 'admin') {
    ok = await adminCanAccessEvent(req.user.id, eventId);
  } else if (role === 'owner') {
    ok = await ownerHasEvent(req.user.id, eventId);
  } else if (role === 'jefe_publicas' || role === 'vendedor') {
    const ownerId = await resolveOwnerScopeForUser(req.user.id);
    ok = !!ownerId && await ownerHasEvent(ownerId, eventId);
  }
  if (!ok) {
    res.status(403).json({ error: 'Sin acceso a este evento' });
    return false;
  }
  return true;
}

const getAll = async (req, res) => {
  try {
    // Owner: solo ve los eventos que le asignaron.
    if (req.user?.role === 'owner') {
      const result = await db.query(
        `SELECT e.*, v.name AS venue_name, v.capacity AS venue_capacity,
                COUNT(DISTINCT CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS tickets_sold
         FROM events e
         JOIN event_owners eo ON eo.event_id = e.id AND eo.user_id = ?
         LEFT JOIN venues v ON v.id = e.venue_id
         LEFT JOIN tickets t ON t.event_id = e.id
         GROUP BY e.id, v.id
         ORDER BY e.date DESC, e.start_time DESC`,
        [req.user.id]
      );
      return res.json(result.rows);
    }

    // Admin SaaS: ve eventos creados por él directamente, o cuyos dueños
    // son owners creados por él. Para multi-admin esto evita que un admin
    // vea eventos de clientes de otro admin.
    if (req.user?.role === 'admin') {
      const { PG_MODE } = require('../config/database');
      const aggOwners = PG_MODE ? `STRING_AGG(u.name, ', ')` : `GROUP_CONCAT(u.name, ', ')`;
      const result = await db.query(
        `SELECT e.*, v.name AS venue_name, v.capacity AS venue_capacity,
                COUNT(DISTINCT CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS tickets_sold,
                (SELECT ${aggOwners}
                 FROM event_owners eo
                 JOIN users u ON u.id = eo.user_id
                 WHERE eo.event_id = e.id) AS owner_names
         FROM events e
         LEFT JOIN venues v ON v.id = e.venue_id
         LEFT JOIN tickets t ON t.event_id = e.id
         WHERE e.created_by = ?
            OR e.id IN (
              SELECT eo.event_id FROM event_owners eo
              JOIN users u ON u.id = eo.user_id
              WHERE u.created_by = ?
            )
         GROUP BY e.id, v.id
         ORDER BY e.date DESC, e.start_time DESC`,
        [req.user.id, req.user.id]
      );
      return res.json(result.rows);
    }

    // Jefe/vendedor: SOLO ven eventos del owner al que pertenecen (anti
    // cross-tenant). Antes era "catálogo global" y un vendedor del owner A
    // podia listar eventos del owner B. Resolvemos el tenant subiendo por
    // created_by: jefe.created_by = owner.id; vendedor.created_by = jefe.id
    // (y jefe.created_by = owner.id).
    if (['jefe_publicas', 'vendedor'].includes(req.user?.role)) {
      let ownerScopeId = null;
      const me = await db.query('SELECT role, created_by FROM users WHERE id = ?', [req.user.id]);
      const u = me.rows[0];
      if (u?.role === 'jefe_publicas') {
        ownerScopeId = u.created_by;
      } else if (u?.role === 'vendedor' && u.created_by) {
        const jefe = await db.query('SELECT created_by FROM users WHERE id = ?', [u.created_by]);
        ownerScopeId = jefe.rows[0]?.created_by || null;
      }
      if (!ownerScopeId) return res.json([]);
      const result = await db.query(
        `SELECT e.*, v.name AS venue_name, v.capacity AS venue_capacity,
                COUNT(DISTINCT CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS tickets_sold
         FROM events e
         JOIN event_owners eo ON eo.event_id = e.id AND eo.user_id = ?
         LEFT JOIN venues v ON v.id = e.venue_id
         LEFT JOIN tickets t ON t.event_id = e.id
         GROUP BY e.id, v.id
         ORDER BY e.date DESC, e.start_time DESC`,
        [ownerScopeId]
      );
      return res.json(result.rows);
    }

    // Sin rol o rol inesperado: vacio.
    res.json([]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
};

const getOne = async (req, res) => {
  try {
    const { id } = req.params;

    if (!await guardEventAccess(req, res, id)) return;

    const eventResult = await db.query(
      `SELECT e.*, v.name AS venue_name, v.capacity AS venue_capacity
       FROM events e LEFT JOIN venues v ON v.id = e.venue_id
       WHERE e.id = ?`, [id]
    );
    if (!eventResult.rows[0]) return res.status(404).json({ error: 'Evento no encontrado' });

    const typesResult = await db.query(
      `SELECT *, (total_quota - sold_count) AS available
       FROM ticket_types WHERE event_id = ? AND is_active = 1`, [id]
    );

    res.json({ ...eventResult.rows[0], ticket_types: typesResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener evento' });
  }
};

// Valida que un flyer_url sea http(s) — antes era string libre y un owner
// podia inyectar `javascript:`, `data:` o protocolos raros que el front
// terminaba renderizando en <img src>. React escapa atributos pero un
// `javascript:` dentro de un href si se escapa en un PDF/email externo.
function sanitizeFlyerUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return null;
  if (s.length > 2000) return null; // antiabuso
  return s;
}

const create = async (req, res) => {
  const { venue_id, name, description, date, start_time, end_time, flyer_url, ticket_types,
          sale_start_at, sale_end_at } = req.body;
  if (!name || !date || !start_time)
    return res.status(400).json({ error: 'name, date y start_time son requeridos' });
  if (!sale_start_at || !sale_end_at)
    return res.status(400).json({ error: 'Fecha y hora de apertura y cierre de venta son requeridas' });
  if (new Date(sale_end_at) <= new Date(sale_start_at))
    return res.status(400).json({ error: 'El cierre de venta debe ser posterior a la apertura' });
  if (flyer_url && !sanitizeFlyerUrl(flyer_url))
    return res.status(400).json({ error: 'flyer_url debe ser una URL http(s) válida' });

  try {
    const eventId = uuidv4();
    await db.transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO events (id, venue_id, name, description, date, start_time, end_time, flyer_url,
                             sale_start_at, sale_end_at, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [eventId, venue_id || null, name, description || null, date, start_time,
         end_time || null, sanitizeFlyerUrl(flyer_url), sale_start_at, sale_end_at, req.user.id]
      );

      if (ticket_types && ticket_types.length > 0) {
        for (const tt of ticket_types) {
          await conn.execute(
            'INSERT INTO ticket_types (id, event_id, name, price, total_quota) VALUES (?,?,?,?,?)',
            [uuidv4(), eventId, tt.name, tt.price, tt.total_quota]
          );
        }
      }

      // Si el creador es owner, se auto-asigna como dueño del evento.
      // El admin SaaS no se asigna; solo crea para vender el sistema.
      if (req.user?.role === 'owner') {
        await conn.execute(
          'INSERT INTO event_owners (id, event_id, user_id) VALUES (?,?,?)',
          [uuidv4(), eventId, req.user.id]
        );
      }
    });

    const result = await db.query('SELECT * FROM events WHERE id = ?', [eventId]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear evento' });
  }
};

// POST /api/events/:id/clone — clona un evento existente con todos sus ticket_types.
// Owner solo puede clonar SUS eventos. Admin puede clonar cualquiera.
// El clon arranca con sold_count=0, sin tickets ni rendiciones.
const cloneEvent = async (req, res) => {
  const { id } = req.params;
  const { name, date, start_time, end_time, sale_start_at, sale_end_at } = req.body;

  if (!await guardEventAccess(req, res, id)) return;
  if (!name || !date || !start_time || !sale_start_at || !sale_end_at)
    return res.status(400).json({ error: 'Faltan datos del nuevo evento (name, date, start_time, sale_start_at, sale_end_at)' });
  if (new Date(sale_end_at) <= new Date(sale_start_at))
    return res.status(400).json({ error: 'El cierre de venta debe ser posterior a la apertura' });

  try {
    const origR = await db.query('SELECT * FROM events WHERE id = ?', [id]);
    const orig = origR.rows[0];
    if (!orig) return res.status(404).json({ error: 'Evento origen no encontrado' });
    const origTT = (await db.query('SELECT name, price, total_quota FROM ticket_types WHERE event_id = ? AND is_active = 1', [id])).rows;

    const newEventId = uuidv4();
    await db.transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO events (id, venue_id, name, description, date, start_time, end_time, flyer_url,
                             sale_start_at, sale_end_at, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [newEventId, orig.venue_id, name, orig.description, date, start_time,
         end_time || orig.end_time, orig.flyer_url, sale_start_at, sale_end_at, req.user.id]
      );
      for (const tt of origTT) {
        await conn.execute(
          'INSERT INTO ticket_types (id, event_id, name, price, total_quota, sold_count) VALUES (?,?,?,?,?,0)',
          [uuidv4(), newEventId, tt.name, tt.price, tt.total_quota]
        );
      }
      // Heredar dueños del evento original (event_owners).
      const origOwners = (await conn.execute('SELECT user_id FROM event_owners WHERE event_id = ?', [id]))[0];
      for (const row of origOwners) {
        await conn.execute(
          'INSERT INTO event_owners (id, event_id, user_id) VALUES (?,?,?)',
          [uuidv4(), newEventId, row.user_id]
        );
      }
      // Si el clonador es owner y no estaba en los dueños originales, lo agregamos.
      if (req.user?.role === 'owner' && !origOwners.some(o => o.user_id === req.user.id)) {
        await conn.execute(
          'INSERT INTO event_owners (id, event_id, user_id) VALUES (?,?,?)',
          [uuidv4(), newEventId, req.user.id]
        );
      }
    });

    const newR = await db.query('SELECT * FROM events WHERE id = ?', [newEventId]);
    res.status(201).json({ ...newR.rows[0], cloned_from: id, ticket_types_copied: origTT.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al clonar evento' });
  }
};

const update = async (req, res) => {
  const { id } = req.params;

  if (!await guardEventAccess(req, res, id)) return;

  const { name, description, date, start_time, end_time, flyer_url, is_active, venue_id,
          sale_start_at, sale_end_at } = req.body;
  if (sale_start_at && sale_end_at && new Date(sale_end_at) <= new Date(sale_start_at))
    return res.status(400).json({ error: 'El cierre de venta debe ser posterior a la apertura' });
  if (flyer_url && !sanitizeFlyerUrl(flyer_url))
    return res.status(400).json({ error: 'flyer_url debe ser una URL http(s) válida' });
  try {
    await db.query(
      `UPDATE events SET name=?, description=?, date=?, start_time=?,
       end_time=?, flyer_url=?, is_active=?, venue_id=?,
       sale_start_at=?, sale_end_at=? WHERE id=?`,
      [name, description, date, start_time, end_time, sanitizeFlyerUrl(flyer_url), is_active ? 1 : 0, venue_id || null,
       sale_start_at || null, sale_end_at || null, id]
    );
    const result = await db.query('SELECT * FROM events WHERE id = ?', [id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar evento' });
  }
};

const stats = async (req, res) => {
  const { id } = req.params;

  if (!await guardEventAccess(req, res, id)) return;

  try {
    const result = await db.query(
      `SELECT tt.name AS tipo, tt.price, tt.total_quota, tt.sold_count,
              (tt.total_quota - tt.sold_count) AS disponibles,
              (tt.sold_count * tt.price) AS recaudado
       FROM ticket_types tt WHERE tt.event_id = ?`, [id]
    );
    const totals = await db.query(
      `SELECT
         COUNT(CASE WHEN status='pagado' THEN 1 END)   AS total_pagados,
         COUNT(CASE WHEN status='usado' THEN 1 END)    AS total_usados,
         COUNT(CASE WHEN status='pendiente' THEN 1 END) AS total_pendientes,
         SUM(CASE WHEN status IN ('pagado','usado') THEN amount_paid ELSE 0 END) AS total_recaudado
       FROM tickets WHERE event_id = ?`, [id]
    );
    res.json({ by_type: result.rows, totals: totals.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

const getVenues = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM venues WHERE is_active = 1 ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener salas' });
  }
};

// GET /api/events/:id/ticket-types
const getTicketTypes = async (req, res) => {
  if (!await guardEventAccess(req, res, req.params.id)) return;
  try {
    const result = await db.query(
      `SELECT *, (total_quota - sold_count) AS available
       FROM ticket_types WHERE event_id = ? ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener tipos de entrada' });
  }
};

// POST /api/events/:id/ticket-types
const addTicketType = async (req, res) => {
  if (!await guardEventAccess(req, res, req.params.id)) return;
  const { name, price, total_quota } = req.body;
  if (!name || price == null || !total_quota)
    return res.status(400).json({ error: 'name, price y total_quota son requeridos' });
  try {
    const id = uuidv4();
    await db.query(
      'INSERT INTO ticket_types (id, event_id, name, price, total_quota) VALUES (?,?,?,?,?)',
      [id, req.params.id, name, parseFloat(price), parseInt(total_quota)]
    );
    const result = await db.query(
      'SELECT *, (total_quota - sold_count) AS available FROM ticket_types WHERE id = ?', [id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear tipo de entrada' });
  }
};

// PUT /api/events/:id/ticket-types/:ttId
const updateTicketType = async (req, res) => {
  if (!await guardEventAccess(req, res, req.params.id)) return;
  const { add_quota, name, price } = req.body;
  try {
    const cur = (await db.query(
      'SELECT * FROM ticket_types WHERE id = ? AND event_id = ?',
      [req.params.ttId, req.params.id]
    )).rows[0];
    if (!cur) return res.status(404).json({ error: 'Tipo de entrada no encontrado' });

    const updates = [];
    const params = [];

    if (add_quota !== undefined && add_quota !== null && add_quota !== '') {
      const qty = parseInt(add_quota);
      if (isNaN(qty) || qty <= 0)
        return res.status(400).json({ error: 'add_quota debe ser mayor a 0' });
      updates.push('total_quota = total_quota + ?');
      params.push(qty);
    }
    if (name !== undefined && name !== null && name.trim() !== '') {
      updates.push('name = ?');
      params.push(name.trim());
    }
    if (price !== undefined && price !== null && price !== '') {
      const p = parseFloat(price);
      if (isNaN(p) || p < 0)
        return res.status(400).json({ error: 'El precio debe ser un numero mayor o igual a 0' });
      updates.push('price = ?');
      params.push(p);
    }
    if (updates.length === 0)
      return res.status(400).json({ error: 'Nada para actualizar (envia add_quota, name o price)' });

    params.push(req.params.ttId, req.params.id);
    await db.query(
      `UPDATE ticket_types SET ${updates.join(', ')} WHERE id=? AND event_id=?`,
      params
    );
    const result = await db.query(
      'SELECT *, (total_quota - sold_count) AS available FROM ticket_types WHERE id = ?',
      [req.params.ttId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('updateTicketType error:', err.message);
    res.status(500).json({ error: 'Error al actualizar tipo de entrada' });
  }
};

// PATCH /api/events/:id/ticket-types/:ttId/toggle
const toggleTicketType = async (req, res) => {
  if (!await guardEventAccess(req, res, req.params.id)) return;
  try {
    await db.query(
      'UPDATE ticket_types SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id=? AND event_id=?',
      [req.params.ttId, req.params.id]
    );
    const result = await db.query(
      'SELECT *, (total_quota - sold_count) AS available FROM ticket_types WHERE id = ?',
      [req.params.ttId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
};

// POST /api/events/:id/reset
const resetEvent = async (req, res) => {
  const { id } = req.params;
  try {
    const evResult = await db.query('SELECT id, name FROM events WHERE id = ?', [id]);
    if (!evResult.rows[0]) return res.status(404).json({ error: 'Evento no encontrado' });

    // Owner solo puede resetear SUS eventos. Sin este check, un owner podia
    // borrar tickets y rendiciones de otro tenant (catastrofico).
    if (req.user?.role === 'owner') {
      const own = await db.query('SELECT 1 FROM event_owners WHERE event_id = ? AND user_id = ?', [id, req.user.id]);
      if (!own.rows[0]) return res.status(403).json({ error: 'No sos dueño de este evento' });
    }

    const before = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM tickets WHERE event_id = ?)     AS tickets,
         (SELECT COUNT(*) FROM rendiciones WHERE event_id = ?) AS rendiciones`,
      [id, id]
    );

    await db.transaction(async (conn) => {
      await conn.execute(
        `DELETE FROM payments WHERE ticket_id IN (SELECT id FROM tickets WHERE event_id = ?)`,
        [id]
      );
      await conn.execute('DELETE FROM tickets     WHERE event_id = ?', [id]);
      await conn.execute('DELETE FROM rendiciones WHERE event_id = ?', [id]);
      await conn.execute('UPDATE ticket_types SET sold_count = 0 WHERE event_id = ?', [id]);
    });

    res.json({
      message: 'Evento reiniciado',
      event_id: id,
      borrados: {
        tickets:     before.rows[0].tickets,
        rendiciones: before.rows[0].rendiciones,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al reiniciar evento' });
  }
};

// GET /api/events/history
const history = async (req, res) => {
  const { from, to, event_id, include_inactive } = req.query;
  const where = ['1=1'];
  const params = [];

  if (!include_inactive || include_inactive === '0') where.push('e.is_active = 1');
  if (from)     { where.push('e.date >= ?'); params.push(from); }
  if (to)       { where.push('e.date <= ?'); params.push(to); }
  if (event_id) { where.push('e.id = ?');    params.push(event_id); }
  // Owner: solo sus eventos.
  if (req.user?.role === 'owner') {
    where.push('e.id IN (SELECT event_id FROM event_owners WHERE user_id = ?)');
    params.push(req.user.id);
  }
  // Admin SaaS: solo eventos creados por el o cuyos dueños son sus owners.
  if (req.user?.role === 'admin') {
    where.push(`(e.created_by = ? OR e.id IN (
      SELECT eo.event_id FROM event_owners eo
      JOIN users u ON u.id = eo.user_id
      WHERE u.created_by = ?
    ))`);
    params.push(req.user.id, req.user.id);
  }

  try {
    const result = await db.query(
      `SELECT e.id AS event_id, e.name, e.date, e.is_active,
              COUNT(CASE WHEN t.status IN ('pagado','usado') AND t.payment_method != 'cortesia' THEN t.id END) AS vendidas,
              COUNT(CASE WHEN t.status = 'usado' THEN t.id END) AS usadas,
              COUNT(CASE WHEN t.payment_method = 'cortesia' THEN t.id END) AS cortesias,
              COUNT(CASE WHEN t.status = 'pendiente' THEN t.id END) AS pendientes,
              COUNT(CASE WHEN t.status = 'cancelado' THEN t.id END) AS canceladas,
              COALESCE(SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END), 0) AS recaudado_total,
              COALESCE(SUM(CASE WHEN t.status IN ('pagado','usado') AND t.payment_method = 'efectivo'      THEN t.amount_paid ELSE 0 END), 0) AS recaudado_efectivo,
              COALESCE(SUM(CASE WHEN t.status IN ('pagado','usado') AND t.payment_method = 'transferencia' THEN t.amount_paid ELSE 0 END), 0) AS recaudado_transferencia,
              COALESCE(SUM(CASE WHEN t.status IN ('pagado','usado') AND t.payment_method = 'mercadopago'   THEN t.amount_paid ELSE 0 END), 0) AS recaudado_mercadopago,
              COALESCE((\n                SELECT SUM(p.commission) FROM tickets t2\n                JOIN promotors p ON p.id = t2.promotor_id\n                WHERE t2.event_id = e.id AND t2.status IN ('pagado','usado')\n              ), 0) AS comisiones_total,
              COALESCE((SELECT SUM(amount) FROM rendiciones WHERE event_id = e.id), 0) AS ya_rindio
       FROM events e
       LEFT JOIN tickets t ON t.event_id = e.id
       WHERE ${where.join(' AND ')}
       GROUP BY e.id
       ORDER BY e.date DESC`,
      params
    );

    const rows = result.rows.map(r => {
      const recaudado_neto = parseFloat(r.recaudado_total || 0) - parseFloat(r.comisiones_total || 0);
      return {
        ...r,
        recaudado_neto,
        pendiente_rendicion: recaudado_neto - parseFloat(r.ya_rindio || 0),
      };
    });

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
};

// ─── Owner management (solo admin) ────────────────────────────────────────────

// GET /api/events/:id/owners — lista los dueños asignados a un evento
const getOwners = async (req, res) => {
  try {
    if (!await guardEventAccess(req, res, req.params.id)) return;
    const result = await db.query(
      `SELECT u.id, u.name, u.apellido, u.email, u.is_active, eo.created_at AS asignado_at
       FROM event_owners eo
       JOIN users u ON u.id = eo.user_id
       WHERE eo.event_id = ?
       ORDER BY eo.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener dueños' });
  }
};

// POST /api/events/:id/owners — asigna un usuario como dueño
const addOwner = async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id es requerido' });
  try {
    // Verificar que el usuario existe, tiene rol owner, y fue creado por
    // ESTE admin (scope multi-tenant: admin_A no puede asignar a owner_B).
    const userRow = await db.query(
      "SELECT id, name, role FROM users WHERE id = ? AND role = 'owner' AND is_active = 1 AND created_by = ?",
      [user_id, req.user.id]
    );
    if (!userRow.rows[0])
      return res.status(400).json({ error: 'Usuario no encontrado o no tiene rol de dueño' });

    // Verificar que el evento tambien le pertenece a este admin (creado por el
    // o asignado a un owner suyo). Sin esto, admin_A podia agregarse a SI mismo
    // un owner suyo a un evento de admin_B.
    const ev = await db.query(
      `SELECT 1 FROM events e
       WHERE e.id = ? AND (
         e.created_by = ?
         OR e.id IN (SELECT eo.event_id FROM event_owners eo
                     JOIN users u ON u.id = eo.user_id
                     WHERE u.created_by = ?)
       )`,
      [req.params.id, req.user.id, req.user.id]
    );
    if (!ev.rows[0]) return res.status(403).json({ error: 'Sin acceso a este evento' });

    await db.query(
      'INSERT OR IGNORE INTO event_owners (id, event_id, user_id) VALUES (?,?,?)',
      [uuidv4(), req.params.id, user_id]
    );
    res.status(201).json({ message: 'Dueño asignado', user: userRow.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al asignar dueño' });
  }
};

// DELETE /api/events/:id/owners/:uid — quita un dueño del evento
const removeOwner = async (req, res) => {
  try {
    if (!await guardEventAccess(req, res, req.params.id)) return;
    await db.query(
      'DELETE FROM event_owners WHERE event_id = ? AND user_id = ?',
      [req.params.id, req.params.uid]
    );
    res.json({ message: 'Dueño removido' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al remover dueño' });
  }
};

// GET /api/events/:id/buyer-stats — estadisticas demograficas del publico
// (basadas en los datos que carga cada comprador al generar su QR).
// Solo cuenta tickets con datos reales (excluye 'Pendiente' y cortesias
// con buyer_name vacio). Owner solo SUS eventos.
const buyerStats = async (req, res) => {
  const { id } = req.params;
  try {
    if (!await guardEventAccess(req, res, id)) return;

    // Base: tickets pagados o usados, con datos cargados (no "Pendiente").
    const baseWhere = `event_id = ? AND status IN ('pagado','usado') AND buyer_name IS NOT NULL AND buyer_name != '' AND buyer_name != 'Pendiente'`;

    const totalR = await db.query(`SELECT COUNT(*) AS c FROM tickets WHERE ${baseWhere}`, [id]);
    const total = parseInt(totalR.rows[0]?.c || 0, 10);

    // Edad: solo los que la cargaron.
    // buyer_edad es TEXT en la DB; casteamos a INT para promedios.
    const ageR = await db.query(
      `SELECT buyer_edad FROM tickets
       WHERE ${baseWhere} AND buyer_edad IS NOT NULL AND buyer_edad != ''`,
      [id]
    );
    const ages = ageR.rows
      .map(r => parseInt(r.buyer_edad, 10))
      .filter(n => !isNaN(n) && n > 0 && n < 120);

    const avgAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;
    const minAge = ages.length > 0 ? Math.min(...ages) : 0;
    const maxAge = ages.length > 0 ? Math.max(...ages) : 0;

    const buckets = { '<18': 0, '18-24': 0, '25-34': 0, '35-44': 0, '45+': 0 };
    ages.forEach(a => {
      if (a < 18) buckets['<18']++;
      else if (a < 25) buckets['18-24']++;
      else if (a < 35) buckets['25-34']++;
      else if (a < 45) buckets['35-44']++;
      else buckets['45+']++;
    });

    // Localidad: top 5.
    const locR = await db.query(
      `SELECT buyer_localidad AS nombre, COUNT(*) AS c
       FROM tickets
       WHERE ${baseWhere} AND buyer_localidad IS NOT NULL AND buyer_localidad != ''
       GROUP BY buyer_localidad
       ORDER BY c DESC
       LIMIT 10`,
      [id]
    );

    // Email: % de gente que dejo email (para futuro marketing).
    const emailR = await db.query(
      `SELECT COUNT(*) AS c FROM tickets
       WHERE ${baseWhere} AND buyer_email IS NOT NULL AND buyer_email != ''`,
      [id]
    );
    const emailsCount = parseInt(emailR.rows[0]?.c || 0, 10);

    res.json({
      total_compradores: total,
      edad: {
        promedio: Math.round(avgAge * 10) / 10,
        min: minAge,
        max: maxAge,
        muestra: ages.length, // cuantos cargaron edad
        cobertura_pct: total > 0 ? Math.round((ages.length / total) * 100) : 0,
        buckets: Object.entries(buckets).map(([rango, n]) => ({
          rango,
          count: n,
          pct: ages.length > 0 ? Math.round((n / ages.length) * 100) : 0,
        })),
      },
      localidades: {
        top: locR.rows.map(r => ({ nombre: r.nombre, count: parseInt(r.c, 10) })),
        muestra: locR.rows.reduce((s, r) => s + parseInt(r.c, 10), 0),
        cobertura_pct: total > 0 ? Math.round((locR.rows.reduce((s, r) => s + parseInt(r.c, 10), 0) / total) * 100) : 0,
      },
      email: {
        count: emailsCount,
        pct: total > 0 ? Math.round((emailsCount / total) * 100) : 0,
      },
    });
  } catch (err) {
    console.error('buyerStats error:', err.message);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

// POST /api/events/:id/stop-sales — corte manual de venta
// El evento sigue accesible para rendiciones, scanner, reportes.
// Para reanudar usar POST /api/events/:id/resume-sales.
const stopSales = async (req, res) => {
  const { id } = req.params;
  try {
    if (!await guardEventAccess(req, res, id)) return;
    const ev = (await db.query('SELECT id, sales_stopped_at FROM events WHERE id = ?', [id])).rows[0];
    if (!ev) return res.status(404).json({ error: 'Evento no encontrado' });
    if (ev.sales_stopped_at) return res.status(200).json({ message: 'La venta ya estaba cortada', sales_stopped_at: ev.sales_stopped_at });
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await db.query('UPDATE events SET sales_stopped_at = ? WHERE id = ?', [now, id]);
    res.json({ message: 'Venta cortada', sales_stopped_at: now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cortar venta' });
  }
};

// POST /api/events/:id/resume-sales — reanudar venta cortada manualmente
const resumeSales = async (req, res) => {
  const { id } = req.params;
  try {
    if (!await guardEventAccess(req, res, id)) return;
    await db.query('UPDATE events SET sales_stopped_at = NULL WHERE id = ?', [id]);
    res.json({ message: 'Venta reanudada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al reanudar venta' });
  }
};

module.exports = {
  getAll, getOne, create, update, stats, history, resetEvent, cloneEvent,
  stopSales, resumeSales, buyerStats,
  getVenues, getTicketTypes, addTicketType, updateTicketType, toggleTicketType,
  getOwners, addOwner, removeOwner,
};
