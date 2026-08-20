const db = require('../config/database');
const { estadoEfectivo } = require('./eventStatus');

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
    'SELECT id, name, date, status, sale_start_at, sale_end_at, sales_stopped_at, is_active FROM events WHERE id = ?',
    [eventId]
  );
  const ev = r.rows[0];
  if (!ev) return { ok: false, status: 404, message: 'Evento no encontrado' };
  if (!ev.is_active) {
    return { ok: false, status: 400, message: 'El evento está inactivo' };
  }
  // Un evento cerrado no vende mas. Va antes que todo lo demas y es el unico
  // punto por el que pasan TODAS las ventas (caja, link publico, pre-venta),
  // asi que alcanza con ponerlo aca para que ningun camino se escape.
  // Usamos el estado efectivo: si la fecha ya paso, cuenta como finalizado
  // aunque el cierre automatico todavia no haya corrido.
  const estado = estadoEfectivo(ev);
  if (estado === 'FINISHED') {
    return { ok: false, status: 409, message: 'El evento ya finalizó: no se pueden vender más entradas' };
  }
  if (estado === 'CANCELLED') {
    return { ok: false, status: 409, message: 'El evento fue cancelado' };
  }
  if (estado === 'DRAFT') {
    return { ok: false, status: 409, message: 'El evento todavía no está publicado' };
  }
  // Corte manual del dueño (sold out o decision). Precede a la ventana planeada.
  if (ev.sales_stopped_at) {
    return { ok: false, status: 400, message: `Venta cortada por el organizador el ${fmt(ev.sales_stopped_at)}` };
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
