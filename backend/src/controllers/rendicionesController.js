const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// GET /api/rendiciones — lista de publicas con saldo
// Devuelve todas las publicas con: vendido, comision, debe enviar, ya rindio, saldo pendiente
const listPublicas = async (req, res) => {
  const { search } = req.query;
  try {
    const params = [];
    let searchClause = '';
    if (search) {
      searchClause = `AND (u.name LIKE ? OR u.apellido LIKE ? OR p.promo_code LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const result = await db.query(
      `SELECT p.id AS promotor_id,
              u.id AS user_id, u.name, u.apellido, u.celular, u.localidad, u.email,
              p.promo_code, p.commission, p.leader_commission,
              lu.name AS leader_name,
              u.role,
              COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS total_vendidas,
              COALESCE(SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END), 0) AS total_recaudado,
              (COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) * p.commission) AS comision_promotor,
              COALESCE(SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END), 0)
                - (COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) * p.commission) AS debe_enviar,
              (SELECT COALESCE(SUM(amount),0) FROM rendiciones WHERE promotor_id = p.id) AS ya_rindio
       FROM promotors p
       JOIN users u ON u.id = p.user_id AND u.is_active = 1
       LEFT JOIN users lu ON lu.id = p.leader_id
       LEFT JOIN tickets t ON t.promotor_id = p.id
       WHERE 1=1 ${searchClause}
       GROUP BY p.id
       ORDER BY u.name ASC`,
      params
    );

    const rows = result.rows.map(r => ({
      ...r,
      saldo_pendiente: (r.debe_enviar || 0) - (r.ya_rindio || 0),
    }));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener rendiciones' });
  }
};

// GET /api/rendiciones/:promotorId — detalle de un publica
const getPublicaDetail = async (req, res) => {
  const { promotorId } = req.params;
  try {
    // perfil
    const profileResult = await db.query(
      `SELECT p.id AS promotor_id,
              u.id AS user_id, u.name, u.apellido, u.celular, u.localidad, u.email,
              u.role, u.created_at,
              p.promo_code, p.commission, p.leader_commission,
              lu.id AS leader_id, lu.name AS leader_name
       FROM promotors p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN users lu ON lu.id = p.leader_id
       WHERE p.id = ?`,
      [promotorId]
    );
    const perfil = profileResult.rows[0];
    if (!perfil) return res.status(404).json({ error: 'Publica no encontrada' });

    // resumen por evento
    const byEvent = await db.query(
      `SELECT e.id AS event_id, e.name AS evento, e.date,
              COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS vendidas,
              COALESCE(SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END), 0) AS recaudado,
              COALESCE(SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END), 0)
                - (COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) * ?) AS a_enviar
       FROM tickets t
       JOIN events e ON e.id = t.event_id
       WHERE t.promotor_id = ?
       GROUP BY e.id ORDER BY e.date DESC`,
      [perfil.commission, promotorId]
    );

    // totales
    const totalsResult = await db.query(
      `SELECT COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS total_vendidas,
              COALESCE(SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END), 0) AS total_recaudado
       FROM tickets t WHERE t.promotor_id = ?`,
      [promotorId]
    );
    const totals = totalsResult.rows[0];
    const comision_promotor = (totals.total_vendidas || 0) * perfil.commission;
    const debe_enviar = (totals.total_recaudado || 0) - comision_promotor;

    // rendiciones registradas
    const pagosResult = await db.query(
      `SELECT r.id, r.amount, r.note, r.created_at, e.name AS evento,
              cu.name AS created_by_name
       FROM rendiciones r
       LEFT JOIN events e ON e.id = r.event_id
       LEFT JOIN users cu ON cu.id = r.created_by
       WHERE r.promotor_id = ?
       ORDER BY r.created_at DESC`,
      [promotorId]
    );
    const ya_rindio = pagosResult.rows.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0);

    // ultimas ventas
    const recent = await db.query(
      `SELECT t.id, t.buyer_name, t.buyer_apellido, t.amount_paid, t.status, t.created_at,
              e.name AS evento, tt.name AS tipo_entrada
       FROM tickets t
       JOIN events e ON e.id = t.event_id
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       WHERE t.promotor_id = ?
       ORDER BY t.created_at DESC LIMIT 50`,
      [promotorId]
    );

    res.json({
      perfil,
      totals: {
        total_vendidas: totals.total_vendidas || 0,
        total_recaudado: totals.total_recaudado || 0,
        comision_promotor,
        debe_enviar,
        ya_rindio,
        saldo_pendiente: debe_enviar - ya_rindio,
      },
      by_event: byEvent.rows,
      pagos: pagosResult.rows,
      recent: recent.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener detalle' });
  }
};

// POST /api/rendiciones — registrar pago
const registrarPago = async (req, res) => {
  const { promotor_id, amount, note, event_id } = req.body;
  if (!promotor_id || !amount) return res.status(400).json({ error: 'Faltan datos' });
  if (parseFloat(amount) <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a 0' });

  try {
    const id = uuidv4();
    await db.query(
      `INSERT INTO rendiciones (id, promotor_id, amount, note, event_id, created_by)
       VALUES (?,?,?,?,?,?)`,
      [id, promotor_id, parseFloat(amount), note || null, event_id || null, req.user.id]
    );
    res.status(201).json({ id, promotor_id, amount, note, event_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar pago' });
  }
};

// DELETE /api/rendiciones/:id — borrar un pago (admin)
const eliminarPago = async (req, res) => {
  try {
    await db.query('DELETE FROM rendiciones WHERE id = ?', [req.params.id]);
    res.json({ message: 'Pago eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar pago' });
  }
};

module.exports = { listPublicas, getPublicaDetail, registrarPago, eliminarPago };
