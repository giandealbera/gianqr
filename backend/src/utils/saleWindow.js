const db = require('../config/database');

const fmt = (d) => new Date(d).toLocaleString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});

/**
 * Verifica que las ventas estén abiertas para el evento.
 * Retorna { ok: true, event } si la ventana está abierta o si el evento
 * no tiene ventana definida (eventos viejos, compatibilidad).
 * Retorna { ok: false, status, message } si está fuera de la ventana.
 */
const checkSaleWindow = async (eventId) => {
  const r = await db.query(
    'SELECT id, name, sale_start_at, sale_end_at, is_active FROM events WHERE id = ?',
    [eventId]
  );
  const ev = r.rows[0];
  if (!ev) return { ok: false, status: 404, message: 'Evento no encontrado' };
  if (!ev.is_active) {
    return { ok: false, status: 400, message: 'El evento está inactivo' };
  }
  const now = new Date();
  if (ev.sale_start_at) {
    const start = new Date(ev.sale_start_at);
    if (now < start) {
      return { ok: false, status: 400, message: `Las ventas abren el ${fmt(start)}` };
    }
  }
  if (ev.sale_end_at) {
    const end = new Date(ev.sale_end_at);
    if (now > end) {
      return { ok: false, status: 400, message: `Ventas cerradas el ${fmt(end)}` };
    }
  }
  return { ok: true, event: ev };
};

module.exports = { checkSaleWindow };
