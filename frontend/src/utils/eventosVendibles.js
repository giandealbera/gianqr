/**
 * ¿A este evento todavía se le pueden generar entradas?
 *
 * Existe para que las pantallas no muestren eventos viejos en los selectores.
 * Antes listaban todo lo que tuviera is_active=1, así que aparecían fiestas
 * de hace meses y era cuestión de tiempo que alguien generara una entrada
 * para el evento equivocado.
 *
 * El criterio sigue al del backend (utils/eventStatus.js), incluidos los dos
 * días de gracia: una fiesta del 15 que sigue hasta las 6 AM del 16 no puede
 * quedar "vencida" a las 00:00, en plena entrada de gente.
 *
 * Es un filtro de PANTALLA, no de seguridad: quien manda es el backend, que
 * revalida la ventana de venta en cada emisión. Acá solo evitamos ofrecer lo
 * que después va a ser rechazado.
 */
const DIAS_DE_GRACIA = 2;

export function esVendible(ev) {
  if (!ev) return false;
  if (!ev.is_active) return false;
  if (['FINISHED', 'CANCELLED', 'DRAFT'].includes(ev.status)) return false;

  if (ev.date) {
    // ev.date viene como YYYY-MM-DD. El mediodía evita que el huso horario
    // corra el día cuando el navegador lo interpreta.
    const limite = new Date(`${ev.date}T12:00:00`);
    if (!isNaN(limite)) {
      limite.setDate(limite.getDate() + DIAS_DE_GRACIA);
      limite.setHours(23, 59, 59, 999);
      if (Date.now() > limite.getTime()) return false;
    }
  }
  return true;
}

export const soloVendibles = (lista) => (lista || []).filter(esVendible);

export default soloVendibles;
