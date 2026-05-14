const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const getAll = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.*, v.name AS venue_name, v.capacity AS venue_capacity,
              COUNT(DISTINCT CASE WHEN t.status='pagado' THEN t.id END) AS tickets_sold
       FROM events e
       LEFT JOIN venues v ON v.id = e.venue_id
       LEFT JOIN tickets t ON t.event_id = e.id
       GROUP BY e.id
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
  const { venue_id, name, description, date, start_time, end_time, flyer_url, ticket_types } = req.body;
  if (!name || !date || !start_time)
    return res.status(400).json({ error: 'name, date y start_time son requeridos' });

  try {
    const eventId = uuidv4();
    await db.transaction(async (conn) => {
      await conn.execute(
        `INSERT INTO events (id, venue_id, name, description, date, start_time, end_time, flyer_url, created_by)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [eventId, venue_id || null, name, description || null, date, start_time,
         end_time || null, flyer_url || null, req.user.id]
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
  const { name, description, date, start_time, end_time, flyer_url, is_active, venue_id } = req.body;
  try {
    await db.query(
      `UPDATE events SET name=?, description=?, date=?, start_time=?,
       end_time=?, flyer_url=?, is_active=?, venue_id=? WHERE id=?`,
      [name, description, date, start_time, end_time, flyer_url, is_active ? 1 : 0, venue_id || null, id]
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

module.exports = { getAll, getOne, create, update, stats, getVenues };
