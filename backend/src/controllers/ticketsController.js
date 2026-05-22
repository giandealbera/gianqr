const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const db = require('../config/database');
const { checkSaleWindow } = require('../utils/saleWindow');

async function generateQR(ticketId) {
  const code    = `GIANQR-${ticketId.split('-')[0].toUpperCase()}`;
  const qrData  = JSON.stringify({ code, ticket_id: ticketId });
  const qrBase64 = await QRCode.toDataURL(qrData, { width: 300 });
  return { code, qrBase64 };
}

// POST /api/tickets — venta manual
const create = async (req, res) => {
  const {
    event_id, ticket_type_id,
    buyer_name, buyer_apellido, buyer_email, buyer_edad, buyer_localidad,
    payment_method, payment_ref, amount_paid,
    promotor_code,
  } = req.body;

  if (!event_id || !ticket_type_id || !buyer_name || !payment_method)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  if (buyer_name.length > 50 || (buyer_apellido && buyer_apellido.length > 50))
    return res.status(400).json({ error: 'El nombre y apellido no deben superar los 50 caracteres' });

  // Whitelist estricto. 'cortesia' tiene su propio endpoint admin-only
  // (POST /api/cortesias) — no se acepta por aca para evitar que cualquier
  // vendedor emita entradas gratis sin pasar por el flujo admin.
  const VALID_METHODS = ['efectivo', 'transferencia', 'mercadopago'];
  if (!VALID_METHODS.includes(payment_method))
    return res.status(400).json({ error: 'Método de pago inválido' });

  // payment_ref='RESERVADO' es un sentinel interno usado por pre-sell.
  // No permitir que se envie desde una venta manual normal: el cliente
  // podria confundir las reservas con tickets ya completos.
  if (payment_ref && payment_ref.toString().toUpperCase() === 'RESERVADO')
    return res.status(400).json({ error: 'payment_ref inválido' });

  const window = await checkSaleWindow(event_id);
  if (!window.ok) return res.status(window.status).json({ error: window.message });

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

      // Buscar promotor: si el vendedor es promotor se asigna solo, sino por código
      let promotorId = null;
      if (['jefe_publicas', 'vendedor'].includes(req.user?.role)) {
        const [pRows] = await conn.execute('SELECT id FROM promotors WHERE user_id = ?', [req.user.id]);
        if (pRows[0]) promotorId = pRows[0].id;
      } else if (promotor_code) {
        const [pRows] = await conn.execute('SELECT id FROM promotors WHERE promo_code = ?', [promotor_code]);
        if (pRows[0]) promotorId = pRows[0].id;
      }

      const { code, qrBase64 } = await generateQR(ticketId);
      const isPaid = ['efectivo', 'transferencia'].includes(payment_method);
      const status = isPaid ? 'pagado' : 'pendiente';
      // Siempre usar el precio canonico del ticket_type. El cliente NO puede
      // enviar amount_paid arbitrario (antes podia mandar 1 y vender un ticket
      // de 5000 por 1).
      const price  = parseFloat(tt.price);

      await conn.execute(
        `INSERT INTO tickets
           (id, event_id, ticket_type_id, buyer_name, buyer_apellido, buyer_email, buyer_edad, buyer_localidad,
            qr_code, payment_method, payment_ref, amount_paid, status, promotor_id, sold_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [ticketId, event_id, ticket_type_id, buyer_name, buyer_apellido || null,
         buyer_email || '', buyer_edad || null, buyer_localidad || null,
         code, payment_method, payment_ref || null,
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

// POST /api/tickets/pre-sell
// Reserva (vende ya) N entradas sin datos del comprador. Devuelve los IDs
// para armar el link que abre el flujo de carga de datos.
// Cuando el admin aprieta "Generar link" en /caja, la entrada
// queda contada como vendida (descuenta cupo) aunque el comprador
// todavia no haya llenado su nombre.
const preSell = async (req, res) => {
  const { event_id, ticket_type_id, qty, payment_method, cortesia } = req.body;

  if (!event_id || !ticket_type_id || !qty)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  const numQty = parseInt(qty, 10);
  if (isNaN(numQty) || numQty < 1 || numQty > 10)
    return res.status(400).json({ error: 'Cantidad invalida (maximo 10)' });

  const isCortesia = !!cortesia;
  // Cortesia: admin siempre; owner solo si el evento es suyo. El resto no.
  if (isCortesia) {
    if (req.user.role === 'admin') {
      /* ok */
    } else if (req.user.role === 'owner') {
      const own = await db.query('SELECT 1 FROM event_owners WHERE event_id = ? AND user_id = ?', [event_id, req.user.id]);
      if (!own.rows[0]) return res.status(403).json({ error: 'No sos dueño de este evento' });
    } else {
      return res.status(403).json({ error: 'Solo admin o dueño del evento puede generar cortesias' });
    }
  }

  // Owner solo puede vender en sus eventos.
  if (req.user.role === 'owner') {
    const own = await db.query('SELECT 1 FROM event_owners WHERE event_id = ? AND user_id = ?', [event_id, req.user.id]);
    if (!own.rows[0]) return res.status(403).json({ error: 'No sos dueño de este evento' });
  }

  const VALID_METHODS = ['efectivo', 'transferencia'];
  if (!isCortesia && !VALID_METHODS.includes(payment_method))
    return res.status(400).json({ error: 'Metodo de pago invalido' });

  // Cortesia bypasea la ventana de venta (consistente con createPublicTicket
  // para code='CASA'): el admin puede regalar entradas fuera de la ventana.
  if (!isCortesia) {
    const window = await checkSaleWindow(event_id);
    if (!window.ok) return res.status(window.status).json({ error: window.message });
  }

  try {
    const createdIds = [];

    await db.transaction(async (conn) => {
      const [ttRows] = await conn.execute(
        'SELECT * FROM ticket_types WHERE id = ? AND event_id = ? AND is_active = 1',
        [ticket_type_id, event_id]
      );
      const tt = ttRows[0];
      if (!tt) throw new Error('TICKET_TYPE_NOT_FOUND');

      const available = tt.total_quota - tt.sold_count;
      if (available < numQty) throw new Error('NO_QUOTA');

      // promotor_id: admin no tiene perfil de promotor, queda null.
      let promotorId = null;
      const [pRows] = await conn.execute('SELECT id FROM promotors WHERE user_id = ?', [req.user.id]);
      if (pRows[0]) promotorId = pRows[0].id;
      else if (['jefe_publicas', 'vendedor'].includes(req.user.role))
        throw new Error('PROMOTOR_NOT_FOUND');

      const fullPrice = parseFloat(tt.price);
      const price = isCortesia ? 0 : fullPrice;
      // El enum tickets.status no incluye 'cortesia' (mismo patron que
      // cortesiasController.js): se distingue por payment_method.
      const status = 'pagado';
      const validMethod = isCortesia ? 'cortesia' : payment_method;

      for (let i = 0; i < numQty; i++) {
        const ticketId = uuidv4();
        const { code } = await generateQR(ticketId);

        await conn.execute(
          `INSERT INTO tickets
             (id, event_id, ticket_type_id, buyer_name, buyer_apellido, buyer_email,
              qr_code, payment_method, payment_ref, amount_paid, status, promotor_id, sold_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [ticketId, event_id, ticket_type_id, 'Pendiente', 'Pendiente', '',
           code, validMethod, 'RESERVADO', price, status, promotorId, req.user.id]
        );

        // Para cortesias no creamos registro en payments (no hubo cobro).
        if (!isCortesia) {
          await conn.execute(
            `INSERT INTO payments (id, ticket_id, method, amount, status, external_id)
             VALUES (?,?,?,?,?,?)`,
            [uuidv4(), ticketId, validMethod, price, 'aprobado', null]
          );
        }

        createdIds.push(ticketId);
      }

      await conn.execute(
        'UPDATE ticket_types SET sold_count = sold_count + ? WHERE id = ?',
        [numQty, ticket_type_id]
      );
    });

    res.status(201).json({ tickets: createdIds });
  } catch (err) {
    if (err.message === 'TICKET_TYPE_NOT_FOUND')
      return res.status(404).json({ error: 'Tipo de entrada no encontrado' });
    if (err.message === 'NO_QUOTA')
      return res.status(409).json({ error: 'Sin cupo disponible suficiente' });
    if (err.message === 'PROMOTOR_NOT_FOUND')
      return res.status(403).json({ error: 'No tenés un perfil de pública asociado' });
    console.error(err);
    res.status(500).json({ error: 'Error al pre-vender tickets' });
  }
};

// POST /api/tickets/scan
const scan = async (req, res) => {
  const { qr_code, ticket_type_id } = req.body;
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

    // Filtro por tipo de entrada si se especificó
    if (ticket_type_id && ticket.ticket_type_id !== ticket_type_id) {
      return res.status(403).json({
        valid: false,
        error: `Tipo incorrecto: esta entrada es "${ticket.tipo_entrada}"`,
        ticket,
      });
    }

    if (ticket.status === 'usado')
      return res.status(409).json({ valid: false, error: 'Esta entrada ya fue utilizada', scanned_at: ticket.scanned_at, ticket });

    if (ticket.status !== 'pagado')
      return res.status(402).json({ valid: false, error: `Estado: ${ticket.status}`, ticket });

    // UPDATE condicional: si dos porteros scanean el mismo QR a la vez, solo
    // uno gana (el que marca 'pagado'->'usado'). El otro ve affectedRows=0
    // y obtiene el mismo 409 que un re-escaneo normal.
    const upd = await db.query(
      "UPDATE tickets SET status='usado', scanned_at=CURRENT_TIMESTAMP, scanned_by=? WHERE id=? AND status='pagado'",
      [req.user.id, ticket.id]
    );
    if (!upd.affectedRows)
      return res.status(409).json({ valid: false, error: 'Esta entrada ya fue utilizada', ticket });

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
    // Owner solo puede ver tickets de SUS eventos (anti-IDOR).
    if (req.user?.role === 'owner') {
      const own = await db.query('SELECT 1 FROM event_owners WHERE event_id = ? AND user_id = ?', [result.rows[0].event_id, req.user.id]);
      if (!own.rows[0]) return res.status(403).json({ error: 'Sin acceso a este ticket' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener ticket' });
  }
};

const getAll = async (req, res) => {
  const { event_id, status, search } = req.query;
  let where = [];
  let params = [];

  // Owner: solo puede ver tickets de sus eventos asignados
  if (req.user?.role === 'owner') {
    // Si especificó un event_id concreto, verificar que le pertenece
    if (event_id) {
      const ok = await db.query(
        'SELECT 1 FROM event_owners WHERE user_id = ? AND event_id = ?',
        [req.user.id, event_id]
      );
      if (!ok.rows[0]) return res.status(403).json({ error: 'Sin acceso a este evento' });
    } else {
      // Sin event_id: restringir a todos sus eventos
      where.push('t.event_id IN (SELECT event_id FROM event_owners WHERE user_id = ?)');
      params.push(req.user.id);
    }
  }

  if (event_id) { where.push('t.event_id = ?'); params.push(event_id); }
  if (status)   { where.push('t.status = ?');   params.push(status); }
  if (search)   {
    where.push('(t.buyer_name LIKE ? OR t.buyer_apellido LIKE ? OR t.buyer_email LIKE ? OR t.buyer_localidad LIKE ? OR t.qr_code LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q, q, q);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  try {
    const result = await db.query(
      `SELECT t.*, tt.name AS tipo_entrada, e.name AS evento, e.date,
              pu.name AS vendedor_nombre, p.promo_code AS vendedor_code
       FROM tickets t
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       JOIN events e ON e.id = t.event_id
       LEFT JOIN promotors p ON p.id = t.promotor_id
       LEFT JOIN users pu ON pu.id = p.user_id
       ${whereClause}
       ORDER BY t.created_at DESC LIMIT 5000`,
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
    const result = await db.query('SELECT qr_code, event_id FROM tickets WHERE id = ?', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Ticket no encontrado' });
    // Owner solo puede generar QR de tickets de SUS eventos (anti-IDOR).
    if (req.user?.role === 'owner') {
      const own = await db.query('SELECT 1 FROM event_owners WHERE event_id = ? AND user_id = ?', [result.rows[0].event_id, req.user.id]);
      if (!own.rows[0]) return res.status(403).json({ error: 'Sin acceso a este ticket' });
    }
    const qrData   = JSON.stringify({ code: result.rows[0].qr_code, ticket_id: req.params.id });
    const qrBase64 = await QRCode.toDataURL(qrData, { width: 300 });
    res.json({ qr_image: qrBase64 });
  } catch (err) {
    res.status(500).json({ error: 'Error al generar QR' });
  }
};

// DELETE /api/tickets/:id — solo admin
const remove = async (req, res) => {
  try {
    const t = await db.query('SELECT ticket_type_id, status FROM tickets WHERE id = ?', [req.params.id]);
    if (!t.rows[0]) return res.status(404).json({ error: 'Ticket no encontrado' });
    const ticketTypeId = t.rows[0].ticket_type_id;
    const wasValid     = ['pagado', 'usado'].includes(t.rows[0].status);

    // Atomico: payments + ticket + sold_count en la misma transaccion.
    // Sin esto, si el delete del ticket fallaba el cupo nunca se liberaba;
    // y si el update fallaba quedaba inconsistente entre ambos.
    await db.transaction(async (conn) => {
      await conn.execute('DELETE FROM payments WHERE ticket_id = ?', [req.params.id]);
      await conn.execute('DELETE FROM tickets WHERE id = ?', [req.params.id]);
      if (wasValid) {
        await conn.execute('UPDATE ticket_types SET sold_count = MAX(0, sold_count - 1) WHERE id = ?', [ticketTypeId]);
      }
    });

    res.json({ message: 'Ticket eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar ticket' });
  }
};

module.exports = { create, preSell, scan, getOne, getAll, getQR, remove };
