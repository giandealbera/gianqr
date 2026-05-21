const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// POST /api/cortesias — admin genera N entradas de cortesia
// body: { event_id, ticket_type_id, attendees: [{name, apellido, edad?, localidad?, email?}] }
const createCortesias = async (req, res) => {
  const { event_id, ticket_type_id, attendees } = req.body;

  if (!event_id || !ticket_type_id)
    return res.status(400).json({ error: 'Faltan datos del evento' });

  if (!Array.isArray(attendees) || attendees.length === 0)
    return res.status(400).json({ error: 'Cargá al menos una persona' });

  if (attendees.length > 50)
    return res.status(400).json({ error: 'Maximo 50 cortesias por vez' });

  for (const a of attendees) {
    if (!a.buyer_name || !a.buyer_apellido)
      return res.status(400).json({ error: 'Cada cortesia debe tener nombre y apellido' });
  }

  // Owner solo puede emitir cortesias para SUS eventos.
  if (req.user.role === 'owner') {
    const own = await db.query('SELECT 1 FROM event_owners WHERE event_id = ? AND user_id = ?', [event_id, req.user.id]);
    if (!own.rows[0]) return res.status(403).json({ error: 'No sos dueño de este evento' });
  }

  try {
    // Buscar promotor CASA para asignar las cortesias
    const promo = await db.query("SELECT id FROM promotors WHERE promo_code = 'CASA'");
    const promotorId = promo.rows[0]?.id || null;

    const ttResult = await db.query(
      'SELECT * FROM ticket_types WHERE id = ? AND event_id = ?',
      [ticket_type_id, event_id]
    );
    const tt = ttResult.rows[0];
    if (!tt) return res.status(400).json({ error: 'Tipo de entrada no encontrado' });
    if ((tt.total_quota - tt.sold_count) < attendees.length)
      return res.status(400).json({ error: `Solo quedan ${tt.total_quota - tt.sold_count} entradas disponibles` });

    const created = [];

    for (const a of attendees) {
      const ticketId = uuidv4();
      const qrCode   = `GIANQR-${ticketId.substring(0, 8).toUpperCase()}`;
      await db.query(
        `INSERT INTO tickets
           (id, ticket_type_id, event_id, buyer_name, buyer_apellido, buyer_edad, buyer_localidad, buyer_email,
            qr_code, payment_method, payment_ref, amount_paid, status, promotor_id, sold_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [ticketId, ticket_type_id, event_id, a.buyer_name, a.buyer_apellido,
         a.buyer_edad || null, a.buyer_localidad || null, a.buyer_email || '',
         qrCode, 'cortesia', 'CORTESIA', 0, 'pagado', promotorId, req.user.id]
      );
      created.push({
        id: ticketId, qr_code: qrCode,
        buyer_name: a.buyer_name, buyer_apellido: a.buyer_apellido,
        tipo_entrada: tt.name,
      });
    }

    await db.query('UPDATE ticket_types SET sold_count = sold_count + ? WHERE id = ?', [attendees.length, ticket_type_id]);

    res.status(201).json({ tickets: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear cortesias' });
  }
};

module.exports = { createCortesias };
