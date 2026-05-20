const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// Helper: verifica si un owner tiene acceso a un evento
async function ownerHasEvent(userId, eventId) {
  const r = await db.query(
    'SELECT 1 FROM event_owners WHERE user_id = ? AND event_id = ?',
    [userId, eventId]
  );
  return r.rows.length > 0;
}

const getAll = async (req, res) => {
  try {
    // Owner: solo ve los eventos que le asignaron
    if (req.user?.role === 'owner') {
      const result = await db.query(
        `SELECT e.*, v.name AS venue_name, v.capacity AS venue_capacity,
                COUNT(DISTINCT CASE WHEN t.status='pagado' THEN t.id END) AS tickets_sold
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

    // Admin / todos: ven todos
    const result = await db.query(
      `SELECT e.*, v.name AS venue_name, v.capacity AS venue_capacity,
              COUNT(DISTINCT CASE WHEN t.status='pagado' THEN t.id END) AS tickets_sold
       FROM events e
       LEFT JOIN venues v ON v.id = e.venue_id
       LEFT JOIN tickets t ON t.event_id = e.id
       GROUP BY e.id, v.id
       ORDER BY e.date DESC, e.start_time DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
};

const getOne = async (req, res) => {
  try {
    const { id } = req.params;

    // Owner: verificar que le pertenece
    if (req.user?.role === 'owner') {
      const ok = await ownerHasEvent(req.user.id, id);
      if (!ok) return res.status(403).json({ error: 'Sin acceso a este evento' });
    }

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

const create = async (req, res) => {
  const { venue_id, name, description, date, start_time, end_time, flyer_url, ticket_types,
          sale_start_at, sale_end_at } = req.body;
  if (!name || !date || !start_time)
    return res.status(400).json({ error: 'name, date y start_time son requeridos' });
  if (!sale_start_at || !sale_end_at)
    return res.status(400).json({ error: 'Fecha y hora de apertura y cierre de venta son requeridas' });
  if (new Date(sale_end_at) <= new Date(sale_start_at))
    return res.status(400).json({ error: 'El cierre de venta debe ser posterior a la apertura' });

  try {
    const eventId = uuidv4();
    await db.transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO events (id, venue_id, name, description, date, start_time, end_time, flyer_url,
                             sale_start_at, sale_end_at, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [eventId, venue_id || null, name, description || null, date, start_time,
         end_time || null, flyer_url || null, sale_start_at, sale_end_at, req.user.id]
      );

      if (ticket_types && ticket_types.length > 0) {
        for (const tt of ticket_types) {
          await conn.execute(
            'INSERT INTO ticket_types (id, event_id, name, price, total_quota) VALUES (?,?,?,?,?)',
            [uuidv4(), eventId, tt.name, tt.price, tt.total_quota]
          );
        }
      }
    });

    const result = await db.query('SELECT * FROM events WHERE id = ?', [eventId]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear evento' });
  }
};

const update = async (req, res) => {
  const { id } = req.params;

  // Owner: verificar que le pertenece antes de modificar
  if (req.user?.role === 'owner') {
    const ok = await ownerHasEvent(req.user.id, id);
    if (!ok) return res.status(403).json({ error: 'Sin acceso a este evento' });
  }

  const { name, description, date, start_time, end_time, flyer_url, is_active, venue_id,
          sale_start_at, sale_end_at } = req.body;
  if (sale_start_at && sale_end_at && new Date(sale_end_at) <= new Date(sale_start_at))
    return res.status(400).json({ error: 'El cierre de venta debe ser posterior a la apertura' });
  try {
    await db.query(
      `UPDATE events SET name=?, description=?, date=?, start_time=?,
       end_time=?, flyer_url=?, is_active=?, venue_id=?,
       sale_start_at=?, sale_end_at=? WHERE id=?`,
      [name, description, date, start_time, end_time, flyer_url, is_active ? 1 : 0, venue_id || null,
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

  // Owner: verificar que le pertenece
  if (req.user?.role === 'owner') {
    const ok = await ownerHasEvent(req.user.id, id);
    if (!ok) return res.status(403).json({ error: 'Sin acceso a este evento' });
  }

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
         SUM(CASE WHEN status='pagado' THEN amount_paid ELSE 0 END) AS total_recaudado
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
  // Owner: verificar acceso
  if (req.user?.role === 'owner') {
    const ok = await ownerHasEvent(req.user.id, req.params.id);
    if (!ok) return res.status(403).json({ error: 'Sin acceso a este evento' });
  }
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
  // Owner: verificar acceso
  if (req.user?.role === 'owner') {
    const ok = await ownerHasEvent(req.user.id, req.params.id);
    if (!ok) return res.status(403).json({ error: 'Sin acceso a este evento' });
  }
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
  // Owner: verificar acceso
  if (req.user?.role === 'owner') {
    const ok = await ownerHasEvent(req.user.id, req.params.id);
    if (!ok) return res.status(403).json({ error: 'Sin acceso a este evento' });
  }
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
  // Owner: verificar acceso
  if (req.user?.role === 'owner') {
    const ok = await ownerHasEvent(req.user.id, req.params.id);
    if (!ok) return res.status(403).json({ error: 'Sin acceso a este evento' });
  }
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
    // Verificar que el usuario existe y tiene rol owner
    const userRow = await db.query(
      "SELECT id, name, role FROM users WHERE id = ? AND role = 'owner' AND is_active = 1",
      [user_id]
    );
    if (!userRow.rows[0])
      return res.status(400).json({ error: 'Usuario no encontrado o no tiene rol de dueño' });

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

module.exports = {
  getAll, getOne, create, update, stats, history, resetEvent,
  getVenues, getTicketTypes, addTicketType, updateTicketType, toggleTicketType,
  getOwners, addOwner, removeOwner,
};
