const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { checkSaleWindow } = require('../utils/saleWindow');

const getPublicEvents = async (req, res) => {
  try {
    // Antes: N+1 — 1 query para eventos + 1 query por evento para ticket_types.
    // Ahora: 2 queries totales, agrupadas en JS. Mucho más rápido con muchos eventos.
    const [evResult, ttResult] = await Promise.all([
      db.query(
        `SELECT e.id, e.name, e.date, e.start_time, v.name as venue_name
         FROM events e
         LEFT JOIN venues v ON v.id = e.venue_id
         WHERE e.is_active = 1
         ORDER BY e.date ASC`
      ),
      db.query(
        `SELECT tt.id, tt.event_id, tt.name, tt.price,
                (tt.total_quota - tt.sold_count) AS available
         FROM ticket_types tt
         JOIN events e ON e.id = tt.event_id
         WHERE tt.is_active = 1 AND e.is_active = 1
           AND (tt.total_quota - tt.sold_count) > 0
         ORDER BY tt.price ASC`
      ),
    ]);

    // Agrupar tipos por evento
    const ttByEvent = {};
    for (const tt of ttResult.rows) {
      if (!ttByEvent[tt.event_id]) ttByEvent[tt.event_id] = [];
      const { event_id, ...rest } = tt;
      ttByEvent[tt.event_id].push(rest);
    }

    const events = evResult.rows
      .filter(ev => ttByEvent[ev.id])
      .map(ev => ({ ...ev, ticket_types: ttByEvent[ev.id] }));

    res.json(events);
  } catch (err) {
    console.error('getPublicEvents error:', err.message);
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
  const { event_id, ticket_type_id, payment_method, attendees, cortesia } = req.body;
  // Cortesia solo se honra para el codigo CASA (interno del dueno)
  const isCortesia = cortesia === true && code === 'CASA';

  if (!event_id || !ticket_type_id)
    return res.status(400).json({ error: 'Faltan datos del evento' });

  // Cortesia (codigo CASA) queda exenta — el admin puede regalar entradas despues
  // de cerrada la venta. El resto se bloquea fuera de la ventana.
  if (!isCortesia) {
    const window = await checkSaleWindow(event_id);
    if (!window.ok) return res.status(window.status).json({ error: window.message });
  }

  if (!Array.isArray(attendees) || attendees.length === 0)
    return res.status(400).json({ error: 'Cargá al menos una persona' });

  if (attendees.length > 10)
    return res.status(400).json({ error: 'Maximo 10 entradas por link' });

  // Validar nombre + apellido en cada attendee
  for (const a of attendees) {
    if (!a.buyer_name || !a.buyer_apellido)
      return res.status(400).json({ error: 'Cada persona debe tener nombre y apellido' });
    if (a.buyer_name.length > 50 || a.buyer_apellido.length > 50)
      return res.status(400).json({ error: 'El nombre y apellido no deben superar los 50 caracteres' });
  }

  try {
    // Verificar que el promotor existe Y su usuario asociado está activo.
    // Sin el join a users un promotor desactivado seguía pudiendo vender por su link.
    const promoResult = await db.query(
      `SELECT p.id FROM promotors p
       JOIN users u ON u.id = p.user_id
       WHERE p.promo_code = ? AND u.is_active = 1`,
      [code]
    );
    const promotor = promoResult.rows[0];
    if (!promotor) return res.status(404).json({ error: 'Link invalido' });

    const validMethod = isCortesia
      ? 'cortesia'
      : (['efectivo', 'transferencia'].includes(payment_method) ? payment_method : 'efectivo');
    const created = [];
    let finalPrice;
    let ttName;

    // Toda la creacion va en una transaccion: revalidamos cupo DENTRO, insertamos
    // los tickets, y subimos sold_count atomicamente. Asi evitamos oversell con
    // requests concurrentes.
    await db.transaction(async (conn) => {
      const [ttRows] = await conn.execute(
        'SELECT * FROM ticket_types WHERE id = ? AND event_id = ? AND is_active = 1',
        [ticket_type_id, event_id]
      );
      const tt = ttRows[0];
      if (!tt) throw new Error('TT_NOT_FOUND');
      if ((tt.total_quota - tt.sold_count) < attendees.length) {
        throw new Error(`NO_QUOTA:${tt.total_quota - tt.sold_count}`);
      }
      finalPrice = isCortesia ? 0 : tt.price;
      ttName = tt.name;

      for (const a of attendees) {
        const ticketId = uuidv4();
        const qrCode   = `GIANQR-${ticketId.substring(0, 8).toUpperCase()}`;
        await conn.execute(
          `INSERT INTO tickets
             (id, ticket_type_id, event_id, buyer_name, buyer_apellido, buyer_edad, buyer_localidad, buyer_email,
              qr_code, payment_method, payment_ref, amount_paid, status, promotor_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [ticketId, ticket_type_id, event_id, a.buyer_name, a.buyer_apellido,
           a.buyer_edad || null, a.buyer_localidad || null, a.buyer_email || '',
           qrCode, validMethod, isCortesia ? 'CORTESIA' : '', finalPrice, 'pagado', promotor.id]
        );
        created.push({
          id: ticketId, qr_code: qrCode,
          buyer_name: a.buyer_name, buyer_apellido: a.buyer_apellido,
          tipo_entrada: tt.name, amount_paid: finalPrice,
        });
      }

      await conn.execute(
        'UPDATE ticket_types SET sold_count = sold_count + ? WHERE id = ?',
        [attendees.length, ticket_type_id]
      );
    });

    res.status(201).json({
      tickets: created,
      total: created.length * parseFloat(finalPrice),
      payment_method: validMethod,
      cortesia: isCortesia,
    });
  } catch (err) {
    if (err.message === 'TT_NOT_FOUND')
      return res.status(400).json({ error: 'Tipo de entrada no disponible' });
    if (err.message?.startsWith('NO_QUOTA:'))
      return res.status(409).json({ error: `Solo quedan ${err.message.split(':')[1]} entradas disponibles` });
    console.error('createPublicTicket error:', err.message);
    res.status(500).json({ error: 'Error al crear entradas' });
  }
};

// GET /api/public/tickets-info?ids=ID1,ID2
// Devuelve info para que el comprador vea evento/tipo/cantidad cuando llega
// por un link de "pre-venta" (/comprar/CASA?tickets=...). Sin datos sensibles.
const getReservedTickets = async (req, res) => {
  const idsParam = (req.query.ids || '').toString().trim();
  if (!idsParam) return res.status(400).json({ error: 'ids requerido' });

  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0 || ids.length > 10)
    return res.status(400).json({ error: 'Cantidad de ids invalida' });

  try {
    const placeholders = ids.map(() => '?').join(',');
    const result = await db.query(
      `SELECT t.id, t.payment_method, t.payment_ref, t.event_id, t.ticket_type_id,
              t.buyer_name, t.buyer_apellido,
              tt.name AS tipo_entrada, tt.price,
              e.name AS evento_name, e.date AS evento_date
         FROM tickets t
         JOIN ticket_types tt ON tt.id = t.ticket_type_id
         JOIN events e ON e.id = t.event_id
        WHERE t.id IN (${placeholders})`,
      ids
    );

    const rows = result.rows || [];
    if (rows.length === 0) return res.status(404).json({ error: 'No se encontraron entradas' });

    // Todos deben ser del mismo evento+tipo y estar pendientes de carga (payment_ref='RESERVADO')
    const allSame = rows.every(r =>
      r.event_id === rows[0].event_id &&
      r.ticket_type_id === rows[0].ticket_type_id &&
      r.payment_ref === 'RESERVADO'
    );
    if (!allSame) return res.status(409).json({ error: 'Link invalido o ya utilizado' });

    res.json({
      event_id: rows[0].event_id,
      event_name: rows[0].evento_name,
      event_date: rows[0].evento_date,
      ticket_type_id: rows[0].ticket_type_id,
      ticket_type_name: rows[0].tipo_entrada,
      price: rows[0].price,
      payment_method: rows[0].payment_method,
      cortesia: rows[0].payment_method === 'cortesia',
      ticket_ids: rows.map(r => r.id),
    });
  } catch (err) {
    console.error('getReservedTickets error:', err.message);
    res.status(500).json({ error: 'Error al consultar entradas' });
  }
};

// POST /api/public/tickets-complete/:code
// El comprador completa nombre/apellido en cada entrada reservada.
// Devuelve los QRs igual que createPublicTicket.
const completeReservedTickets = async (req, res) => {
  const { code } = req.params;
  const { ticket_ids, attendees } = req.body;

  if (!Array.isArray(ticket_ids) || ticket_ids.length === 0)
    return res.status(400).json({ error: 'ticket_ids requerido' });
  if (!Array.isArray(attendees) || attendees.length !== ticket_ids.length)
    return res.status(400).json({ error: 'attendees debe coincidir con ticket_ids' });

  for (const a of attendees) {
    if (!a.buyer_name || !a.buyer_apellido)
      return res.status(400).json({ error: 'Cada persona debe tener nombre y apellido' });
    if (a.buyer_name.length > 50 || a.buyer_apellido.length > 50)
      return res.status(400).json({ error: 'El nombre y apellido no deben superar los 50 caracteres' });
  }

  try {
    const placeholders = ticket_ids.map(() => '?').join(',');
    const result = await db.query(
      `SELECT id, payment_ref, event_id, ticket_type_id, qr_code
         FROM tickets WHERE id IN (${placeholders})`,
      ticket_ids
    );
    const rows = result.rows || [];
    if (rows.length !== ticket_ids.length)
      return res.status(404).json({ error: 'Entradas no encontradas' });
    if (rows.some(r => r.payment_ref !== 'RESERVADO'))
      return res.status(409).json({ error: 'Estas entradas ya estan completas' });

    // Para CASA no requerimos validar promotor (admin generó la reserva).
    if (code !== 'CASA') {
      const promo = await db.query(
        `SELECT p.id FROM promotors p
          JOIN users u ON u.id = p.user_id
         WHERE p.promo_code = ? AND u.is_active = 1`,
        [code]
      );
      if (!promo.rows[0]) return res.status(404).json({ error: 'Link invalido' });
    }

    const created = [];
    await db.transaction(async (conn) => {
      for (let i = 0; i < ticket_ids.length; i++) {
        const tid = ticket_ids[i];
        const a = attendees[i];
        await conn.execute(
          `UPDATE tickets
              SET buyer_name = ?, buyer_apellido = ?,
                  buyer_edad = ?, buyer_localidad = ?, buyer_email = ?,
                  payment_ref = ''
            WHERE id = ? AND payment_ref = 'RESERVADO'`,
          [a.buyer_name, a.buyer_apellido,
           a.buyer_edad || null, a.buyer_localidad || null, a.buyer_email || '',
           tid]
        );
        const row = rows.find(r => r.id === tid);
        created.push({
          id: tid, qr_code: row.qr_code,
          buyer_name: a.buyer_name, buyer_apellido: a.buyer_apellido,
        });
      }
    });

    res.status(200).json({ tickets: created });
  } catch (err) {
    console.error('completeReservedTickets error:', err.message);
    res.status(500).json({ error: 'Error al completar entradas' });
  }
};

// POST /api/public/recover/:code — comprador busca sus tickets por nombre+apellido
const recoverTickets = async (req, res) => {
  const { code } = req.params;
  const { nombre, apellido } = req.body;

  if (!nombre || !apellido)
    return res.status(400).json({ error: 'Cargá nombre y apellido para recuperar tus entradas' });

  try {
    const promo = await db.query('SELECT id FROM promotors WHERE promo_code = ?', [code]);
    if (!promo.rows[0]) return res.status(404).json({ error: 'Link invalido' });

    const result = await db.query(
      `SELECT t.id, t.qr_code, t.buyer_name, t.buyer_apellido, t.amount_paid, t.created_at, t.status,
              tt.name AS tipo_entrada, e.name AS evento, e.date AS event_date
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN events e ON e.id = t.event_id
       WHERE t.promotor_id = ?
         AND LOWER(TRIM(t.buyer_name))     = LOWER(TRIM(?))
         AND LOWER(TRIM(t.buyer_apellido)) = LOWER(TRIM(?))
         AND t.status IN ('pagado','usado')
       ORDER BY t.created_at DESC
       LIMIT 20`,
      [promo.rows[0].id, nombre, apellido]
    );

    res.json({ tickets: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al buscar entradas' });
  }
};

module.exports = {
  getPublicEvents,
  getPromoterInfo,
  createPublicTicket,
  recoverTickets,
  getReservedTickets,
  completeReservedTickets,
};
