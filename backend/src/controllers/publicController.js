const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const getPublicEvents = async (req, res) => {
  try {
    const evResult = await db.query(
      `SELECT e.id, e.name, e.date, e.start_time, v.name as venue_name
       FROM events e
       LEFT JOIN venues v ON v.id = e.venue_id
       WHERE e.is_active = 1
       ORDER BY e.date ASC`
    );
    const events = [];
    for (const ev of evResult.rows) {
      const ttResult = await db.query(
        `SELECT id, name, price, (total_quota - sold_count) as available
         FROM ticket_types
         WHERE event_id = ? AND is_active = 1 AND (total_quota - sold_count) > 0
         ORDER BY price ASC`,
        [ev.id]
      );
      if (ttResult.rows.length > 0) events.push({ ...ev, ticket_types: ttResult.rows });
    }
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
};

const getPromoterInfo = async (req, res) => {
  const { code } = req.params;
  try {
    const result = await db.query(
      `SELECT u.name, u.apellido, p.promo_code
       FROM promotors p
       JOIN users u ON u.id = p.user_id
       WHERE p.promo_code = ? AND u.is_active = 1`,
      [code]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Link invalido' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
};

const createPublicTicket = async (req, res) => {
  const { code } = req.params;
  const { event_id, ticket_type_id, buyer_name, buyer_apellido, buyer_dni, buyer_celular, buyer_email, payment_method } = req.body;

  if (!event_id || !ticket_type_id || !buyer_name || !buyer_apellido || !buyer_dni || !buyer_celular)
    return res.status(400).json({ error: 'Nombre, apellido, DNI y celular son requeridos' });

  try {
    const promoResult = await db.query('SELECT id FROM promotors WHERE promo_code = ?', [code]);
    const promotor = promoResult.rows[0];
    if (!promotor) return res.status(404).json({ error: 'Link invalido' });

    const ttResult = await db.query(
      'SELECT * FROM ticket_types WHERE id = ? AND event_id = ? AND is_active = 1',
      [ticket_type_id, event_id]
    );
    const tt = ttResult.rows[0];
    if (!tt) return res.status(400).json({ error: 'Tipo de entrada no disponible' });
    if (tt.total_quota - tt.sold_count <= 0) return res.status(400).json({ error: 'Sin disponibilidad' });

    const ticketId = uuidv4();
    const qrCode   = `GIANQR-${ticketId.substring(0, 8).toUpperCase()}`;

    await db.query(
      `INSERT INTO tickets
         (id, ticket_type_id, event_id, buyer_name, buyer_apellido, buyer_dni, buyer_celular, buyer_email,
          qr_code, payment_method, payment_ref, amount_paid, status, promotor_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [ticketId, ticket_type_id, event_id, buyer_name, buyer_apellido, buyer_dni, buyer_celular,
       buyer_email || '', qrCode, payment_method || 'efectivo', '', tt.price, 'pagado', promotor.id]
    );

    await db.query('UPDATE ticket_types SET sold_count = sold_count + 1 WHERE id = ?', [ticket_type_id]);

    res.status(201).json({
      id: ticketId, qr_code: qrCode,
      buyer_name, buyer_apellido,
      tipo_entrada: tt.name,
      amount_paid: tt.price,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear entrada' });
  }
};

module.exports = { getPublicEvents, getPromoterInfo, createPublicTicket };
