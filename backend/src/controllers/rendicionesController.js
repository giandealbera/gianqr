const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// GET /api/rendiciones — lista de publicas con saldo
// Devuelve todas las publicas con: vendido, comision, debe enviar, ya rindio, saldo pendiente
const listPublicas = async (req, res) => {
  const { search, event_id } = req.query;
  try {
    const params = [];
    let searchClause = '';
    if (search) {
      searchClause = `AND (u.name LIKE ? OR u.apellido LIKE ? OR p.promo_code LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Si filtran por evento: tickets se cuentan sólo de ese evento y `ya_rindio` también
    let ticketJoinClause = 'LEFT JOIN tickets t ON t.promotor_id = p.id';
    let yaRindioClause   = '(SELECT COALESCE(SUM(amount),0) FROM rendiciones WHERE promotor_id = p.id)';
    if (event_id) {
      ticketJoinClause = 'LEFT JOIN tickets t ON t.promotor_id = p.id AND t.event_id = ?';
      yaRindioClause   = '(SELECT COALESCE(SUM(amount),0) FROM rendiciones WHERE promotor_id = p.id AND event_id = ?)';
      params.unshift(event_id);  // primer ? del query
      params.push(event_id);     // ? del subselect
    }

    const result = await db.query(
      `SELECT p.id AS promotor_id,
              u.id AS user_id, u.name, u.apellido, u.celular, u.localidad, u.email,
              p.promo_code, p.commission, p.leader_commission, p.zona_id,
              z.name AS zona_name,
              lu.name AS leader_name,
              u.role,
              COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS total_vendidas,
              COALESCE(SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END), 0) AS total_recaudado,
              (COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) * p.commission) AS comision_promotor,
              COALESCE(SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END), 0)
                - (COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) * p.commission) AS debe_enviar,
              ${yaRindioClause} AS ya_rindio
       FROM promotors p
       JOIN users u ON u.id = p.user_id AND u.is_active = 1
       LEFT JOIN zonas z ON z.id = p.zona_id
       LEFT JOIN users lu ON lu.id = p.leader_id
       ${ticketJoinClause}
       WHERE u.role != 'admin' AND p.promo_code != 'CASA' ${searchClause}
       GROUP BY p.id, u.id, z.id, lu.id
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

    // resumen por evento (incluye ya pagado por ese evento)
    const byEvent = await db.query(
      `SELECT e.id AS event_id, e.name AS evento, e.date,
              COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS vendidas,
              COALESCE(SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END), 0) AS recaudado,
              COALESCE(SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END), 0)
                - (COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) * ?) AS a_enviar,
              COALESCE(
                (SELECT SUM(r.amount) FROM rendiciones r
                 WHERE r.promotor_id = ? AND r.event_id = e.id), 0
              ) AS pagado_evento
       FROM tickets t
       JOIN events e ON e.id = t.event_id
       WHERE t.promotor_id = ?
       GROUP BY e.id ORDER BY e.date DESC`,
      [perfil.commission, promotorId, promotorId]
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
// Valida que el monto no exceda el saldo pendiente (global o por evento)
// para evitar errores tipo "registré 50.000 cuando solo debe 10.000".
const registrarPago = async (req, res) => {
  const { promotor_id, amount, note, event_id } = req.body;
  if (!promotor_id || !amount) return res.status(400).json({ error: 'Faltan datos' });
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0)
    return res.status(400).json({ error: 'El monto debe ser un numero mayor a 0' });

  try {
    // Calcular el saldo pendiente actual (global o filtrado por evento).
    // Reusa la misma logica que getPublicaDetail.
    const eventFilter = event_id ? 'AND t.event_id = ?' : '';
    const eventRendicionFilter = event_id ? 'AND event_id = ?' : '';
    const rendicionParams = event_id ? [promotor_id, event_id] : [promotor_id];

    const totals = (await db.query(
      `SELECT
         COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS total_vendidas,
         COALESCE(SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END), 0) AS total_recaudado
       FROM tickets t
       WHERE t.promotor_id = ? ${eventFilter}`,
      event_id ? [promotor_id, event_id] : [promotor_id]
    )).rows[0];

    const promoResult = await db.query('SELECT commission FROM promotors WHERE id = ?', [promotor_id]);
    const commission = parseFloat(promoResult.rows[0]?.commission || 0);
    const debeEnviar = parseFloat(totals.total_recaudado || 0) - (parseInt(totals.total_vendidas || 0) * commission);

    const yaRindioResult = await db.query(
      `SELECT COALESCE(SUM(amount),0) AS ya_rindio FROM rendiciones
       WHERE promotor_id = ? ${eventRendicionFilter}`,
      rendicionParams
    );
    const yaRindio = parseFloat(yaRindioResult.rows[0]?.ya_rindio || 0);
    const saldoPendiente = debeEnviar - yaRindio;

    // Tolerancia de $0.01 para evitar problemas de floating-point
    if (amountNum > saldoPendiente + 0.01) {
      return res.status(400).json({
        error: `El monto excede el saldo pendiente ($${saldoPendiente.toFixed(2)}). Si querés registrar un pago mayor, agregalo en notas o creá una nota de credito.`,
        saldo_pendiente: saldoPendiente,
      });
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO rendiciones (id, promotor_id, amount, note, event_id, created_by)
       VALUES (?,?,?,?,?,?)`,
      [id, promotor_id, amountNum, note || null, event_id || null, req.user.id]
    );
    res.status(201).json({ id, promotor_id, amount: amountNum, note, event_id, saldo_restante: saldoPendiente - amountNum });
  } catch (err) {
    console.error('registrarPago error:', err.message);
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
