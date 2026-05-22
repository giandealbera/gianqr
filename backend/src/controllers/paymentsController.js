const db = require('../config/database');

// GET /api/payments/report
const report = async (req, res) => {
  const { event_id, from, to } = req.query;
  let where = ["t.status IN ('pagado', 'usado')"];
  let params = [];

  if (event_id) { where.push('t.event_id = ?'); params.push(event_id); }
  if (from)     { where.push('t.created_at >= ?'); params.push(from); }
  if (to)       { where.push('t.created_at <= ?'); params.push(to + ' 23:59:59'); }

  // Scope multi-admin: admin solo ve tickets de eventos creados por el o
  // asignados a sus owners. Sin esto, en un SaaS multi-admin un admin veria
  // los reportes financieros de otros admins.
  if (req.user?.role === 'admin') {
    where.push(`(
      t.event_id IN (SELECT id FROM events WHERE created_by = ?)
      OR t.event_id IN (
        SELECT eo.event_id FROM event_owners eo
        JOIN users u ON u.id = eo.user_id
        WHERE u.created_by = ?
      )
    )`);
    params.push(req.user.id, req.user.id);
  }

  const whereClause = 'WHERE ' + where.join(' AND ');

  try {
    const resumen = await db.query(
      `SELECT t.payment_method, COUNT(*) AS cantidad, SUM(t.amount_paid) AS total
       FROM tickets t ${whereClause} GROUP BY t.payment_method`, params
    );
    const detalle = await db.query(
      `SELECT t.id, t.buyer_name, t.buyer_email, t.amount_paid,
              t.payment_method, t.payment_ref, t.created_at,
              tt.name AS tipo_entrada, e.name AS evento
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN events e ON e.id = t.event_id
       ${whereClause}
       ORDER BY t.created_at DESC`, params
    );
    const total = resumen.rows.reduce((acc, r) => acc + parseFloat(r.total || 0), 0);
    res.json({ resumen: resumen.rows, detalle: detalle.rows, total_general: total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar reporte' });
  }
};

// GET /api/payments/monthly-overview
// Devuelve mes a mes: entradas vendidas, cortesías y eventos realizados
const monthlyOverview = async (req, res) => {
  try {
    const { PG_MODE } = require('../config/database');
    // Postgres usa TO_CHAR + INTERVAL, SQLite usa strftime + date('-12 months').
    const monthExpr = (col) => PG_MODE ? `TO_CHAR(${col}, 'YYYY-MM')` : `strftime('%Y-%m', ${col})`;
    const last12 = PG_MODE ? `(NOW() - INTERVAL '12 months')` : `date('now', '-12 months')`;

    // Si es owner, filtramos solo sus eventos (los que tiene en event_owners).
    // Admin ve todo.
    const isOwner = req.user?.role === 'owner';
    const ownerFilterTickets = isOwner
      ? `AND t.event_id IN (SELECT event_id FROM event_owners WHERE user_id = ?)`
      : '';
    const ownerFilterEvents = isOwner
      ? `AND e.id IN (SELECT event_id FROM event_owners WHERE user_id = ?)`
      : '';
    const ownerParams = isOwner ? [req.user.id] : [];

    // Entradas vendidas + cortesías por mes (últimos 12 meses)
    const ticketsPerMonth = await db.query(
      `SELECT
         ${monthExpr('t.created_at')} AS mes,
         COUNT(CASE WHEN t.payment_method != 'cortesia' AND t.status IN ('pagado','usado') THEN 1 END) AS vendidas,
         COUNT(CASE WHEN t.payment_method = 'cortesia' THEN 1 END) AS cortesias
       FROM tickets t
       WHERE t.created_at >= ${last12} ${ownerFilterTickets}
       GROUP BY mes
       ORDER BY mes ASC`,
      ownerParams
    );

    // Eventos realizados por mes (fecha del evento, no fecha de creación)
    // events.date es TEXT 'YYYY-MM-DD', usamos SUBSTR universal.
    const eventsPerMonth = await db.query(
      `SELECT
         SUBSTR(e.date, 1, 7) AS mes,
         COUNT(*) AS fiestas
       FROM events e
       WHERE e.date >= ${PG_MODE ? `TO_CHAR(NOW() - INTERVAL '12 months', 'YYYY-MM-DD')` : `date('now', '-12 months')`} ${ownerFilterEvents}
       GROUP BY mes
       ORDER BY mes ASC`,
      ownerParams
    );

    // Merge por mes
    const monthMap = {};

    ticketsPerMonth.rows.forEach(r => {
      if (!monthMap[r.mes]) monthMap[r.mes] = { mes: r.mes, vendidas: 0, cortesias: 0, fiestas: 0 };
      monthMap[r.mes].vendidas  = parseInt(r.vendidas  || 0);
      monthMap[r.mes].cortesias = parseInt(r.cortesias || 0);
    });

    eventsPerMonth.rows.forEach(r => {
      if (!monthMap[r.mes]) monthMap[r.mes] = { mes: r.mes, vendidas: 0, cortesias: 0, fiestas: 0 };
      monthMap[r.mes].fiestas = parseInt(r.fiestas || 0);
    });

    const data = Object.values(monthMap).sort((a, b) => a.mes.localeCompare(b.mes));
    res.json({ monthly: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al generar reporte mensual' });
  }
};

module.exports = { report, monthlyOverview };
