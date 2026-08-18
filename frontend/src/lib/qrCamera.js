import { Html5Qrcode } from 'html5-qrcode';

// Arranque de camara compartido por el escaner del admin (Scanner.jsx) y el
// del portero (PublicScanner.jsx). Antes cada uno tenia su copia del mismo
// bloque y un bug habia que arreglarlo dos veces.

// Config del decodificador.
//
// IMPORTANTE: NO seteamos `aspectRatio`. Cuando ese campo existe,
// html5-qrcode ejecuta track.applyConstraints({aspectRatio}) SIN try/catch
// (ver html5-qrcode.min.js, VideoElement.create). En iOS Safari y en varios
// Android la camara no puede entregar un stream 1:1, esa promesa rechaza con
// OverconstrainedError y se lleva puesto todo el start(). Sintoma: el
// escaner queda con el boton "Activar camara" que nunca funciona.
export const SCAN_CONFIG = {
  // 30 FPS = lectura casi instantanea del QR en la puerta.
  fps: 30,
  qrbox: (viewWidth, viewHeight) => {
    const minEdge = Math.min(viewWidth, viewHeight);
    // El recuadro NUNCA puede superar al contenedor: la libreria tira
    // "'config.qrbox' dimensions should not be greater than the dimensions
    // of the root HTML element" y aborta el arranque. Buscamos el 85% del
    // lado corto, con un piso de 240px, pero siempre topeado al contenedor.
    const size = Math.min(minEdge, Math.max(Math.floor(minEdge * 0.85), 240));
    return { width: size, height: size };
  },
  disableFlip: false,
};

// Pedimos HD para que el QR entre nitido aunque el celular este lejos, pero
// TODO como `ideal`: si el device no lo soporta negocia lo mas parecido en
// vez de rechazar la peticion.
const HD_REAR = {
  facingMode: 'environment',
  width:  { ideal: 1280 },
  height: { ideal: 720 },
};

// Config minima de ultimo recurso (la que usabamos historicamente y andaba
// en todos lados). Si la HD falla, preferimos escanear mas lento a no
// escanear nada.
const FALLBACK_CONFIG = { fps: 10, qrbox: { width: 250, height: 250 } };

// Enfoque continuo: se aplica DESPUES de arrancar y con catch. Mandarlo
// dentro de getUserMedia hace que algunos devices rechacen el stream entero.
async function tryContinuousFocus(html5) {
  try {
    if (typeof html5.applyVideoConstraints === 'function') {
      await html5.applyVideoConstraints({ focusMode: 'continuous' });
    }
  } catch { /* el device no soporta focusMode: no es critico */ }
}

// Traduce el error crudo del navegador a algo que el portero entienda.
function friendlyCamError(err) {
  const name = err?.name || '';
  const msg  = String(err?.message || err || '');
  if (/NotAllowedError|Permission/i.test(name + msg))
    return 'Permiso de cámara denegado. Habilitalo en los ajustes del navegador y recargá.';
  if (/NotFoundError|DevicesNotFound/i.test(name + msg))
    return 'No se detectó ninguna cámara en este dispositivo.';
  if (/NotReadableError|TrackStartError/i.test(name + msg))
    return 'La cámara está siendo usada por otra aplicación. Cerrala y reintentá.';
  if (/OverconstrainedError|ConstraintNotSatisfied/i.test(name + msg))
    return 'La cámara no soporta la configuración pedida. Probá con otro dispositivo.';
  if (/secure context|https/i.test(msg))
    return 'La cámara solo funciona por HTTPS.';
  return `No se pudo abrir la cámara: ${msg || 'error desconocido'}`;
}

/**
 * Arranca la camara trasera probando varias estrategias, de la mas nitida a
 * la mas compatible. Devuelve { ok:true } o { ok:false, error:<texto> }.
 *
 * Antes esto vivia duplicado en los dos escaneres y el catch final se tragaba
 * la excepcion: el portero veia un boton "Activar camara" que fallaba en
 * silencio para siempre, sin ninguna pista del motivo.
 */
export async function startQrCamera(html5, onDecoded) {
  if (!html5) return { ok: false, error: 'El escáner todavía no está listo.' };

  // Cada intento: [descripcion, fuente de video, config]
  const attempts = [
    ['hd-environment',    HD_REAR,                  SCAN_CONFIG],
    ['plain-environment', { facingMode: 'environment' }, SCAN_CONFIG],
  ];

  let lastErr = null;

  for (const [, source, config] of attempts) {
    try {
      await html5.start(source, config, onDecoded, () => {});
      await tryContinuousFocus(html5);
      return { ok: true };
    } catch (err) {
      // Si ya estaba corriendo, la camara funciona: no hay nada que hacer.
      if (/already\s*(under\s*)?running/i.test(String(err?.message || err))) {
        return { ok: true };
      }
      lastErr = err;
    }
  }

  // Ultimo recurso: enumerar camaras y usar la que parezca trasera, primero
  // con la config rapida y despues con la minima historica.
  try {
    const cams = await Html5Qrcode.getCameras();
    if (!cams?.length) return { ok: false, error: 'No se detectó ninguna cámara en este dispositivo.' };
    const back = cams.find(c => /back|rear|tras|environment/i.test(c.label || '')) || cams[cams.length - 1];

    for (const config of [SCAN_CONFIG, FALLBACK_CONFIG]) {
      try {
        await html5.start(back.id, config, onDecoded, () => {});
        await tryContinuousFocus(html5);
        return { ok: true };
      } catch (err) {
        if (/already\s*(under\s*)?running/i.test(String(err?.message || err))) {
          return { ok: true };
        }
        lastErr = err;
      }
    }
  } catch (err) {
    lastErr = err;
  }

  return { ok: false, error: friendlyCamError(lastErr) };
}
