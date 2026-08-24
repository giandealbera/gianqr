const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { userCanAccessEvent } = require('../utils/scope');

/**
 * Da de alta a un comprador en el newsletter.
 *
 * Se llama desde el flujo publico cuando la persona MARCA la casilla. Nunca
 * de oficio: quien deja su mail lo hace para recibir el QR, y sumarlo sin que
 * lo pida ademas de no ser consentimiento valido dispara quejas de spam en el
 * mismo dominio con el que mandamos las entradas.
 *
 * Es fire-and-forget: si falla, la compra NO se cae. Perder una suscripcion
 * es molesto; perder una venta es grave.
 */
async function suscribir({ email, nombre, apellido, eventId }) {
  const limpio = String(email || '').trim().toLowerCase();
  if (!limpio || !limpio.includes('@')) return false;
  try {
    // INSERT OR IGNORE + el indice unico (email, event_id): si la persona
    // compra dos veces para el mismo evento no se duplica, y si ya se habia
    // dado de baja no la resucitamos.
    await db.query(
      `INSERT OR IGNORE INTO newsletter_subscribers (id, email, nombre, apellido, event_id)
       VALUES (?,?,?,?,?)`,
      [uuidv4(), limpio, nombre || null, apellido || null, eventId || null]
    );
    return true;
  } catch (err) {
    console.error('newsletter suscribir error:', err.message);
    return false;
  }
}

/**
 * GET /api/newsletter?event_id=
 *
 * Suscriptores de los eventos a los que el usuario tiene acceso. Sin
 * event_id devuelve los de todos sus eventos.
 *
 * Deduplica por email: la misma persona anotada en tres eventos aparece una
 * sola vez, con la fecha de su primera alta.
 */
const listar = async (req, res) => {
  const { event_id } = req.query;

  // Un event_id concreto: se valida el acceso a ese evento.
  if (event_id) {
    if (!await userCanAccessEvent(req.user, event_id))
      return res.status(403).json({ error: 'Sin acceso a este evento' });
  }

  // Sin event_id: acotamos a los eventos del usuario. Sin este filtro, un
  // dueño se llevaria la base de contactos de otro organizador.
  let filtro = '';
  const params = [];
  if (event_id) {
    filtro = 'AND s.event_id = ?';
    params.push(event_id);
  } else if (req.user.role === 'owner') {
    filtro = 'AND s.event_id IN (SELECT event_id FROM event_owners WHERE user_id = ?)';
    params.push(req.user.id);
  } else if (req.user.role === 'admin') {
    filtro = `AND s.event_id IN (
      SELECT e.id FROM events e
      WHERE e.created_by = ?
         OR e.id IN (SELECT eo.event_id FROM event_owners eo
                     JOIN users u ON u.id = eo.user_id
                     WHERE u.created_by = ?)
    )`;
    params.push(req.user.id, req.user.id);
  } else {
    return res.status(403).json({ error: 'Sin acceso' });
  }

  try {
    const r = await db.query(
      `SELECT s.email,
              MIN(s.nombre)     AS nombre,
              MIN(s.apellido)   AS apellido,
              MIN(s.created_at) AS desde,
              COUNT(*)          AS eventos
         FROM newsletter_subscribers s
        WHERE s.unsubscribed_at IS NULL ${filtro}
        GROUP BY s.email
        ORDER BY MIN(s.created_at) DESC
        LIMIT 5000`,
      params
    );
    res.json({ total: r.rows.length, suscriptores: r.rows });
  } catch (err) {
    console.error('newsletter listar error:', err.message);
    res.status(500).json({ error: 'Error al obtener los suscriptores' });
  }
};

module.exports = { suscribir, listar };
