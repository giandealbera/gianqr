import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

// Arranque de camara compartido por el escaner del admin (Scanner.jsx) y el
// del portero (PublicScanner.jsx). Antes cada uno tenia su copia del mismo
// bloque y un bug habia que arreglarlo dos veces.

/**
 * Crea el escaner ya afinado para velocidad.
 *
 * Las dos opciones de abajo son la diferencia mas grande en tiempo de
 * lectura, y van en el CONSTRUCTOR (no en start()):
 *
 *  - formatsToSupport: por defecto html5-qrcode arma un lector multi-formato
 *    con 17 simbologias (Aztec, PDF417, DataMatrix, EAN, UPC, ITF, Codabar,
 *    Code39/93/128, RSS...) y las prueba UNA POR UNA en cada frame. Nosotros
 *    solo emitimos QR, asi que 16 de esos 17 decoders son trabajo tirado en
 *    cada cuadro de video. Restringirlo a QR_CODE es la mayor ganancia,
 *    sobre todo en iPhone, donde no existe el decoder nativo del navegador.
 *
 *  - useBarCodeDetectorIfSupported: usa el BarcodeDetector nativo cuando el
 *    navegador lo tiene (Chrome en Android), que decodifica por hardware y
 *    es varias veces mas rapido que el decoder JS. Hoy la libreria ya lo
 *    activa por defecto, pero lo dejamos explicito para que una actualizacion
 *    de la dependencia no nos lo apague sin que nos demos cuenta.
 */
export function createQrScanner(elementId) {
  return new Html5Qrcode(elementId, {
    verbose: false,
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    experimentalFeatures: { useBarCodeDetectorIfSupported: true },
  });
}

// Pausa/reanuda SOLO la decodificacion (el stream de video sigue abierto, no
// se vuelve a pedir permiso de camara). Lo usamos mientras se muestra el
// cartel de resultado: sin esto la libreria sigue decodificando a 30 FPS
// contra un elemento oculto, quemando bateria y CPU al pedo.
// Van con try/catch porque la libreria tira excepcion si el escaner no esta
// en el estado esperado (todavia no arranco, ya estaba pausado, etc).
export function pauseScanner(html5) {
  try { if (typeof html5?.pause === 'function') html5.pause(false); } catch { /* no estaba escaneando */ }
}

export function resumeScanner(html5) {
  try { if (typeof html5?.resume === 'function') html5.resume(); } catch { /* no estaba pausado */ }
}

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
  // Sin doble pasada espejada. Cuando disableFlip es false (el default),
  // por cada frame que NO logra decodificar la libreria da vuelta el canvas
  // y vuelve a intentar: el doble de trabajo justo en el caso mas comun
  // (mientras el portero esta apuntando). Un QR en la pantalla de un celular
  // o impreso nunca viene espejado, y siempre usamos la camara trasera, asi
  // que esa segunda pasada no sirve para nada.
  disableFlip: true,
  qrbox: (viewWidth, viewHeight) => {
    const minEdge = Math.min(viewWidth, viewHeight);
    // El recuadro NUNCA puede superar al contenedor: la libreria tira
    // "'config.qrbox' dimensions should not be greater than the dimensions
    // of the root HTML element" y aborta el arranque. Buscamos el 85% del
    // lado corto, con un piso de 240px, pero siempre topeado al contenedor.
    const size = Math.min(minEdge, Math.max(Math.floor(minEdge * 0.85), 240));
    return { width: size, height: size };
  },
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
const FALLBACK_CONFIG = { fps: 10, qrbox: { width: 250, height: 250 }, disableFlip: true };

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
