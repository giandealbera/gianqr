const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// POST /api/payments/mp/create-preference
const createMPPreference = async (req, res) => {
  const { ticket_id } = req.body;
  if (!ticket_id) return res.status(400).json({ error: 'ticket_id requerido' });

  try {
    const { MercadoPagoConfig, Preference } = require('mercadopago');
    const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

    const ticketResult = await db.query(
      `SELECT t.*, tt.name AS tipo, tt.price, e.name AS evento
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN events e ON e.id = t.event_id
       WHERE t.id = ?`, [ticket_id]
    );
    const ticket = ticketResult.rows[0];
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (ticket.status !== 'pendiente') return res.status(409).json({ error: 'Ticket ya procesado' });

    const preference = new Preference(client);
    const prefData = await preference.create({
      body: {
        items: [{
          id: ticket.id,
          title: `${ticket.evento} - ${ticket.tipo}`,
          quantity: 1,
          unit_price: parseFloat(ticket.amount_paid || ticket.price),
          currency_id: 'ARS',
        }],
        payer: { name: ticket.buyer_name, email: ticket.buyer_email },
        external_reference: ticket.id,
        notification_url: `http://localhost:4000/api/payments/mp/webhook`,
        back_urls: {
          success: `${process.env.FRONTEND_URL}/pago/exito?ticket=${ticket.id}`,
          failure: `${process.env.FRONTEND_URL}/pago/error?ticket=${ticket.id}`,
          pending: `${process.env.FRONTEND_URL}/pago/pendiente?ticket=${ticket.id}`,
        },
        auto_return: 'approved',
      },
    });

    res.json({ preference_id: prefData.id, init_point: prefData.init_point, sandbox_init_point: prefData.sandbox_init_point });
  } catch (err) {
    console.error('MP preference error:', err);
    res.status(500).json({ error: 'Error al crear preferencia de pago' });
  }
};

// POST /api/payments/mp/webhook
const mpWebhook = async (req, res) => {
  const { type, data } = req.body;
  if (type !== 'payment') return res.sendStatus(200);

  try {
    const { MercadoPagoConfig, Payment } = require('mercadopago');
    const client     = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
    const paymentApi = new Payment(client);
    const mpPayment  = await paymentApi.get({ id: data.id });

    const ticketId = mpPayment.external_reference;
    if (mpPayment.status === 'approved') {
      await db.query(
        "UPDATE tickets SET status='pagado', payment_ref=? WHERE id=? AND status='pendiente'",
        [String(mpPayment.id), ticketId]
      );
      await db.query(
        "INSERT IGNORE INTO payments (id, ticket_id, method, amount, status, external_id, external_data) VALUES (?,?,'mercadopago',?,'aprobado',?,?)",
        [uuidv4(), ticketId, mpPayment.transaction_amount, String(mpPayment.id), JSON.stringify(mpPayment)]
      );
    } else if (mpPayment.status === 'rejected') {
      await db.query("UPDATE tickets SET status='cancelado' WHERE id=? AND status='pendiente'", [ticketId]);
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('MP webhook error:', err);
    res.sendStatus(500);
  }
};

// GET /api/payments/report
const report = async (req, res) => {
  const { event_id, from, to } = req.query;
  let where = ["t.status = 'pagado'"];
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

module.exports = { createMPPreference, mpWebhook, report };
