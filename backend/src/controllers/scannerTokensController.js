const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// GET /api/scanner-tokens?event_id= — admin lista tokens activos de un evento
const getTokens = async (req, res) => {
  const { event_id } = req.query;
  if (!event_id) return res.status(400).json({ error: 'event_id requerido' });
  try {
    const result = await db.query(
      `SELECT st.*, tt.name AS ticket_type_name, e.name AS event_name
       FROM scanner_tokens st
       JOIN ticket_types tt ON tt.id = st.ticket_type_id
       JOIN events e ON e.id = st.event_id
       WHERE st.event_id = ? AND st.is_active = 1
       ORDER BY st.created_at DESC`,
      [event_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tokens' });
  }
};

// POST /api/scanner-tokens — admin genera un link para una tanda
const createToken = async (req, res) => {
  const { event_id, ticket_type_id, label } = req.body;
  if (!event_id || !ticket_type_id)
    return res.status(400).json({ error: 'event_id y ticket_type_id son requeridos' });
  try {
    const id    = uuidv4();
    const token = uuidv4();
    await db.query(
      'INSERT INTO scanner_tokens (id, token, event_id, ticket_type_id, label, created_by) VALUES (?,?,?,?,?,?)',
      [id, token, event_id, ticket_type_id, label || null, req.user.id]
    );
    const result = await db.query(
      `SELECT st.*, tt.name AS ticket_type_name, e.name AS event_name
       FROM scanner_tokens st
       JOIN ticket_types tt ON tt.id = st.ticket_type_id
       JOIN events e ON e.id = st.event_id
       WHERE st.id = ?`, [id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear token' });
  }
};

// DELETE /api/scanner-tokens/:id — admin desactiva un link
const deleteToken = async (req, res) => {
  try {
    await db.query('UPDATE scanner_tokens SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Token desactivado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar token' });
  }
};

// GET /api/scan/:token — info del escáner (público, sin auth)
const getScannerInfo = async (req, res) => {
  const { token } = req.params;
  try {
    const result = await db.query(
      `SELECT st.*, e.name AS event_name, e.date AS event_date,
              tt.name AS ticket_type_name, tt.price AS ticket_price
       FROM scanner_tokens st
       JOIN events e ON e.id = st.event_id
       JOIN ticket_types tt ON tt.id = st.ticket_type_id
       WHERE st.token = ? AND st.is_active = 1`,
      [token]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Link inválido o desactivado' });
    const row = result.rows[0];
    res.json({
      event_name:        row.event_name,
      event_date:        row.event_date,
      ticket_type_name:  row.ticket_type_name,
      ticket_price:      row.ticket_price,
      label:             row.label,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener info del escáner' });
  }
};

// POST /api/scan/:token — escanear QR (público, sin auth)
const publicScan = async (req, res) => {
  const { token } = req.params;
  const { qr_code } = req.body;
  if (!qr_code) return res.status(400).json({ error: 'qr_code requerido' });

  try {
    const tokenResult = await db.query(
      `SELECT st.*, tt.name AS ticket_type_name, e.name AS event_name
       FROM scanner_tokens st
       JOIN events e ON e.id = st.event_id
       JOIN ticket_types tt ON tt.id = st.ticket_type_id
       WHERE st.token = ? AND st.is_active = 1`,
      [token]
    );
    if (!tokenResult.rows[0]) return res.status(403).json({ error: 'Link inválido o desactivado' });

    const scannerInfo = tokenResult.rows[0];

    const ticketResult = await db.query(
      `SELECT t.*, tt.name AS tipo_entrada, e.name AS evento
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN events e ON e.id = t.event_id
       WHERE t.qr_code = ?`,
      [qr_code]
    );
    const ticket = ticketResult.rows[0];
    if (!ticket) return res.status(404).json({ valid: false, error: 'QR no válido' });

    if (ticket.event_id !== scannerInfo.event_id)
      return res.status(400).json({ valid: false, error: 'Este ticket es de otro evento', ticket });

    if (ticket.ticket_type_id !== scannerInfo.ticket_type_id)
      return res.status(400).json({
        valid: false,
        error: `Ticket tipo "${ticket.tipo_entrada}" — este escáner es solo para "${scannerInfo.ticket_type_name}"`,
        ticket,
      });

    if (ticket.status === 'usado')
      return res.status(409).json({ valid: false, error: 'Esta entrada ya fue utilizada', ticket });

    if (ticket.status !== 'pagado')
      return res.status(402).json({ valid: false, error: `Estado inválido: ${ticket.status}`, ticket });

    await db.query(
      "UPDATE tickets SET status='usado', scanned_at=CURRENT_TIMESTAMP WHERE id=?",
      [ticket.id]
    );
    ticket.status     = 'usado';
    ticket.scanned_at = new Date().toISOString();

    res.json({ valid: true, message: '✅ Entrada válida. ¡Bienvenido!', ticket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al escanear' });
  }
};

module.exports = { getTokens, createToken, deleteToken, getScannerInfo, publicScan };
