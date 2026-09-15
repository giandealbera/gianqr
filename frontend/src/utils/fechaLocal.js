/**
 * Conversion entre lo que devuelve la API y lo que espera un
 * <input type="datetime-local">.
 *
 * Por que existe: el input trabaja SIEMPRE en hora local y sin marca de zona
 * ("2026-09-20T20:00"). La API, en cambio, devuelve la fecha en formato ISO
 * UTC cuando el backend corre contra Postgres ("2026-09-20T23:00:00.000Z"),
 * porque el driver devuelve un Date y JSON lo serializa asi.
 *
 * El formulario de edicion hacia `valor.slice(0, 16)`, que corta los digitos
 * de la cadena UTC y los mete tal cual en un campo que los lee como hora
 * local. Resultado con Argentina en UTC-3:
 *
 *   el dueño guarda apertura de ventas a las 20:00
 *   abre el formulario para cambiar el nombre  -> ve 23:00
 *   guarda                                     -> la venta ahora abre 23:00
 *
 * Y cada edicion la corria tres horas mas. En un evento con puerta a las
 * 23:00 eso significa no vender.
 *
 * Ojo con el otro motor: en SQLite la API devuelve "2026-09-20 20:00:00"
 * (con espacio y sin zona). El slice ahi tampoco servia, porque el input
 * necesita la "T" en el medio. Estas funciones cubren los dos formatos.
 */

/**
 * API -> input. Devuelve 'YYYY-MM-DDTHH:mm' en hora LOCAL.
 */
export function paraInputLocal(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  // Corremos el instante por el offset local para que toISOString, que
  // siempre imprime UTC, termine escupiendo los digitos de la hora local.
  const corrido = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return corrido.toISOString().slice(0, 16);
}

/**
 * input -> API. El valor del input ya es hora local sin zona, que es
 * exactamente lo que el backend guarda, asi que va tal cual. Existe como
 * funcion para dejar el par explicito y que nadie "arregle" el envio
 * agregandole una conversion a UTC, que es lo que rompe todo.
 */
export function desdeInputLocal(valor) {
  return valor || null;
}
