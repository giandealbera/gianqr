const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const db = require('../config/database');

async function generateQR(ticketId) {
  const code    = `GIANQR-${ticketId.split('-')[0].toUpperCase()}`;
  const qrData  = JSON.stringify({ code, ticket_id: ticketId });
  const qrBase64 = await QRCode.toDataURL(qrData, { width: 300 });
  return { code, qrBase64 };
}

// POST /api/tickets — venta manual (cajero)
const create = async (req, res) => {
  const {
    event_id, ticket_type_id,
    buyer_name, buyer_email, buyer_dni,
    payment_method, payment_ref, amount_paid,
    promotor_code,
  } = req.body;

  if (!event_id || !ticket_type_id || !buyer_name || !buyer_email || !payment_method)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  try {
    const ticketId = uuidv4();
    let ticketResult;

    await db.transaction(async (conn) => {
      // Verificar cupo disponible (sin FOR UPDATE — SQLite serializa por defecto en transacciones)
      const [ttRows] = await conn.execute(
        'SELECT * FROM ticket_types WHERE id = ? AND is_active = 1',
        [ticket_type_id]
      );
      const tt = ttRows[0];
      if (!tt) throw new Error('TICKET_TYPE_NOT_FOUND');
      if (tt.sold_count >= tt.total_quota) throw new Error('NO_QUOTA');

      // Buscar promotor
      let promotorId = null;
      if (promotor_code) {
        const [pRows] = await conn.execute('SELECT id FROM promotors WHERE promo_code = ?', [promotor_code]);
        if (pRows[0]) promotorId = pRows[0].id;
      }

      const { code, qrBase64 } = await generateQR(ticketId);
      const isPaid = ['efectivo', 'transferencia'].includes(payment_method);
      const status = isPaid ? 'pagado' : 'pendiente';
      const price  = parseFloat(amount_paid || tt.price);

      await conn.execute(
        `INSERT INTO tickets
           (id, event_id, ticket_type_id, buyer_name, buyer_email, buyer_dni,
            qr_code, payment_method, payment_ref, amount_paid, status, promotor_id, sold_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [ticketId, event_id, ticket_type_id, buyer_name, buyer_email,
         buyer_dni || null, code, payment_method, payment_ref || null,
         price, status, promotorId, req.user?.id || null]
      );

      if (isPaid) {
        await conn.execute(
          `INSERT INTO payments (id, ticket_id, method, amount, status, external_id)
           VALUES (?,?,?,?,?,?)`,
          [uuidv4(), ticketId, 'efectivo', price, 'aprobado', payment_ref || null]
        );
        await conn.execute(
          'UPDATE ticket_types SET sold_count = sold_count + 1 WHERE id = ?',
          [ticket_type_id]
        );
      }

      // Guardar qrBase64 para la respuesta
      ticketResult = { qrBase64 };
    });

    const result = await db.query('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    const ticket = result.rows[0];
    ticket.qr_image = ticketResult.qrBase64;
    res.status(201).json(ticket);
  } catch (err) {
    if (err.message === 'TICKET_TYPE_NOT_FOUND')
      return res.status(404).json({ error: 'Tipo de entrada no encontrado' });
    if (err.message === 'NO_QUOTA')
      return res.status(409).json({ error: 'Sin cupo disponible' });
    console.error(err);
    res.status(500).json({ error: 'Error al crear ticket' });
  }
};

// POST /api/tickets/scan
const scan = async (req, res) => {
  const { qr_code } = req.body;
  if (!qr_code) return res.status(400).json({ error: 'qr_code requerido' });

  try {
    const result = await db.query(
      `SELECT t.*, tt.name AS tipo_entrada, e.name AS evento, e.date, e.start_time
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN events e ON e.id = t.event_id
       WHERE t.qr_code = ?`, [qr_code]
    );

    const ticket = result.rows[0];
    if (!ticket) return res.status(404).json({ error: 'QR no válido', valid: false });

    if (ticket.status === 'usado')
      return res.status(409).json({ valid: false, error: 'Esta entrada ya fue utilizada', scanned_at: ticket.scanned_at, ticket });

    if (ticket.status !== 'pagado')
      return res.status(402).json({ valid: false, error: `Estado: ${ticket.status}`, ticket });

    await db.query(
      'UPDATE tickets SET status=?, scanned_at=CURRENT_TIMESTAMP, scanned_by=? WHERE id=?',
      ['usado', req.user.id, ticket.id]
    );

    ticket.status     = 'usado';
    ticket.scanned_at = new Date();
    res.json({ valid: true, message: 'Entrada válida. ¡Bienvenido!', ticket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al escanear QR' });
  }
};

const getOne = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, tt.name AS tipo_entrada, tt.price,
              e.name AS evento, e.date, e.start_time, v.name AS sala
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN events e ON e.id = t.event_id
       LEFT JOIN venues v ON v.id = e.venue_id
       WHERE t.id = ?`, [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ticket' });
  }
};

const getAll = async (req, res) => {
  const { event_id, status, search } = req.query;
  let where = [];
  let params = [];

  if (event_id) { where.push('t.event_id = ?'); params.push(event_id); }
  if (status)   { where.push('t.status = ?');   params.push(status); }
  if (search)   { where.push('(t.buyer_name LIKE ? OR t.buyer_email LIKE ? OR t.qr_code LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  try {
    const result = await db.query(
      `SELECT t.*, tt.name AS tipo_entrada, e.name AS evento, e.date
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN events e ON e.id = t.event_id
       ${whereClause}
       ORDER BY t.created_at DESC LIMIT 200`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tickets' });
  }
};

const getQR = async (req, res) => {
  try {
    const result = await db.query('SELECT qr_code FROM tickets WHERE id = ?', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Ticket no encontrado' });
    const qrData   = JSON.stringify({ code: result.rows[0].qr_code, ticket_id: req.params.id });
    const qrBase64 = await QRCode.toDataURL(qrData, { width: 300 });
    res.json({ qr_image: qrBase64 });
  } catch (err) {
    res.status(500).json({ error: 'Error al generar QR' });
  }
};

module.exports = { create, scan, getOne, getAll, getQR };
