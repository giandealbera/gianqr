const db = require('../config/database');

// GET /api/payments/report
const report = async (req, res) => {
  const { event_id, from, to } = req.query;
  let where = ["t.status IN ('pagado', 'usado')"];
  let params = [];

  if (event_id) { where.push('t.event_id = ?'); params.push(event_id); }
  if (from)     { where.push('t.created_at >= ?'); params.push(from); }
  if (to)       { where.push('t.created_at <= ?'); params.push(to + ' 23:59:59'); }

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

module.exports = { report };
