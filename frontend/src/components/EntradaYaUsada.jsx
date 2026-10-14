/**
 * Explica POR QUE una entrada figura como usada, en los terminos en que el
 * portero tiene que decidir: dejarla pasar o frenarla.
 *
 * El problema real: con wifi de boliche, el escaneo llega al servidor pero la
 * respuesta se pierde. El portero ve "error de conexion", vuelve a escanear
 * la misma entrada, y ahora le dice "ya fue utilizada". Es la MISMA persona,
 * parada adelante, y lo mas probable es que la frene por un corte de red.
 *
 * Mostrar la fecha completa no alcanza: a las 2 AM, con cola, nadie hace la
 * cuenta de cuantos segundos pasaron. Asi que la hacemos nosotros:
 *
 *   - hace segundos y por ESTA misma puerta  -> casi seguro fue el corte:
 *     se lo decimos y le sugerimos dejarla pasar.
 *   - hace rato, o por OTRA puerta           -> alguien ya entro con esa
 *     entrada: el dato clave es cual puerta, para ir a preguntar.
 */

// Ventana dentro de la cual un re-escaneo en la misma puerta se explica por
// un corte de red y no por un duplicado. 25s cubre un timeout lento + que el
// portero vuelva a apuntar, sin llegar a tapar un duplicado real.
const SEGUNDOS_CORTE = 25;

function hace(segundos) {
  if (segundos < 60) return `hace ${Math.max(1, Math.round(segundos))} segundos`;
  const min = Math.round(segundos / 60);
  if (min < 60) return `hace ${min} minuto${min === 1 ? '' : 's'}`;
  const h = Math.floor(min / 60);
  return `hace ${h}h ${min % 60}min`;
}

/**
 * @param {object} ticket      el que devuelve el escaneo (trae scanned_at y puerta)
 * @param {string} [miPuerta]  label de la puerta de ESTE escaner, si se sabe
 */
const EntradaYaUsada = ({ ticket, miPuerta }) => {
  if (!ticket?.scanned_at) {
    // Sin hora no podemos explicar nada util. Pasa si la entrada se marco
    // por un camino viejo que no guardaba el dato.
    return (
      <p className="text-xs text-gray-400 mt-2">
        Ya figura utilizada, pero no quedó registrado cuándo.
      </p>
    );
  }

  const cuando   = new Date(ticket.scanned_at);
  const segundos = (Date.now() - cuando.getTime()) / 1000;
  const puerta   = ticket.puerta || null;
  const mismaPuerta = !!puerta && !!miPuerta && puerta === miPuerta;
  const fueRecien   = segundos >= 0 && segundos < SEGUNDOS_CORTE;

  // Si el "hace cuanto" da negativo o absurdo, el reloj del servidor y el del
  // celular no coinciden (o la fecha vino sin zona horaria). Preferimos no
  // decir nada antes que decir "hace -3 horas", que destruye la confianza del
  // portero en todo lo demas que muestra la pantalla.
  const tiempoConfiable = Number.isFinite(segundos) && segundos >= 0;
  if (!tiempoConfiable) {
    return (
      <div className="mt-2 rounded-lg px-3 py-2 text-left"
           style={{ background: '#211516', border: '1px solid #45292B' }}>
        <p className="text-xs font-semibold" style={{ color: '#D47779' }}>
          Ya se usó{puerta && <> · {puerta}</>}
        </p>
        <p className="text-xs mt-1" style={{ color: '#9AA3B2' }}>Verificá antes de dejar pasar.</p>
        <p className="text-[10px] mt-1.5" style={{ color: '#6B7280' }}>
          {cuando.toLocaleString('es-AR')}
        </p>
      </div>
    );
  }

  if (mismaPuerta && fueRecien) {
    return (
      <div className="mt-2 rounded-lg px-3 py-2 text-left"
           style={{ background: '#12201A', border: '1px solid #2A4232' }}>
        <p className="text-xs font-semibold" style={{ color: '#78B884' }}>
          Se escaneó {hace(segundos)} en esta misma puerta
        </p>
        <p className="text-xs mt-1" style={{ color: '#9AA3B2' }}>
          Seguramente se cortó la conexión en el intento anterior y sí quedó
          registrada. Es la misma persona: dejala pasar.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg px-3 py-2 text-left"
         style={{ background: '#211516', border: '1px solid #45292B' }}>
      <p className="text-xs font-semibold" style={{ color: '#D47779' }}>
        Ya se usó {hace(segundos)}
        {puerta && <> · {mismaPuerta ? 'esta misma puerta' : puerta}</>}
      </p>
      <p className="text-xs mt-1" style={{ color: '#9AA3B2' }}>
        {puerta && !mismaPuerta
          ? `Alguien entró con esta entrada por ${puerta}. Verificá antes de dejar pasar.`
          : 'Verificá antes de dejar pasar.'}
      </p>
      <p className="text-[10px] mt-1.5" style={{ color: '#6B7280' }}>
        {cuando.toLocaleString('es-AR')}
      </p>
    </div>
  );
};

export default EntradaYaUsada;
