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

// En toda la app puede haber UNA sola camara viva. La guardamos aca para
// poder apagarla siempre, incluso si una instancia quedo suelta por una
// carrera entre dos arranques. Dos instancias vivas = dos camaras prendidas
// y dos previews apilados ("la camara ve doble").
let instanciaViva = null;

// Apaga y desmonta una instancia. Siempre con catch: si el start() quedo a
// medias, stop() tambien tira.
export async function destroyQrScanner(html5) {
  if (!html5) return;
  if (html5 === instanciaViva) { instanciaViva = null; videoVivo = null; dejarDeVigilar(); }
  try { await html5.stop(); } catch { /* no estaba corriendo */ }
  try { html5.clear(); } catch { /* nada que limpiar */ }
}

function contenedor(elementId) {
  return typeof document === 'undefined' ? null : document.getElementById(elementId);
}

// Vacia el contenedor del escaner. Ojo: hay que llamarlo antes de CADA
// intento, no una sola vez. Si un intento deja su <video> puesto (stop() y
// clear() tiran cuando la instancia quedo a medias, y ahi el elemento
// sobrevive) y el intento siguiente arranca bien, quedan los dos apilados
// dentro del mismo div: la camara "se ve doble".
function limpiarContenedor(elementId) {
  const host = contenedor(elementId);
  if (host) host.innerHTML = '';
}

// El <video> de la instancia que arranco bien. Es la referencia para saber
// cual conservar: un resto tardio puede aparecer DESPUES del bueno, asi que
// "quedarse con el ultimo" elegiria el equivocado.
let videoVivo = null;

/**
 * Deja UN solo preview en el contenedor: elimina todo <video> que no sea el
 * de la instancia activa, cortandole las pistas para que ademas libere la
 * camara. Devuelve cuantos elimino.
 */
function dejarUnSoloPreview(elementId) {
  const host = contenedor(elementId);
  if (!host) return 0;
  const videos = [...host.querySelectorAll('video')];
  if (videos.length <= 1) return 0;

  let eliminados = 0;
  for (const v of videos) {
    // Sin referencia conocida conservamos el primero, que es el que la
    // libreria monto para el escaner en curso.
    if (v === (videoVivo || videos[0])) continue;
    try { v.srcObject?.getTracks?.().forEach(t => t.stop()); } catch { /* ya cortado */ }
    try { v.remove(); } catch { /* ya no estaba */ }
    eliminados++;
  }
  return eliminados;
}

// Vigilante del contenedor. Un intento fallido puede insertar su <video>
// DESPUES de que su promesa rechazo, ya con el escaner andando: ese resto
// tardio es el que dejaba el preview duplicado. Adivinar cuando pasa con un
// setTimeout es fragil, asi que escuchamos el DOM y lo sacamos apenas
// aparece, sin importar cuanto tarde.
let vigilante = null;

function dejarDeVigilar() {
  try { vigilante?.disconnect(); } catch { /* ya desconectado */ }
  vigilante = null;
}

function vigilarPreviewsDuplicados(elementId) {
  dejarDeVigilar();
  if (typeof MutationObserver === 'undefined') return;
  const host = contenedor(elementId);
  if (!host) return;
  vigilante = new MutationObserver(() => {
    if (host.querySelectorAll('video').length > 1) dejarUnSoloPreview(elementId);
  });
  vigilante.observe(host, { childList: true });
}

// Errores donde reintentar con otra configuracion no cambia nada: el problema
// es el permiso o el hardware, no los constraints.
function esFatal(err) {
  const s = `${err?.name || ''} ${err?.message || err || ''}`;
  return /NotAllowedError|Permission|NotFoundError|DevicesNotFound|secure context/i.test(s);
}

/**
 * Arranca la camara trasera probando varias estrategias, de la mas nitida a
 * la mas compatible. Devuelve { ok, scanner } o { ok:false, error }.
 *
 * Clave: CADA intento usa una instancia NUEVA.
 *
 * html5-qrcode maneja su ciclo de vida con una maquina de estados que marca
 * "transicion en curso" al empezar el start(). Si ese start() falla por un
 * camino que no cancela la transicion, la instancia queda trabada: todo
 * start/stop/pause posterior sobre ella tira "Cannot transition to a new
 * state, already under transition". Reintentando sobre la misma instancia,
 * ese mensaje terminaba pisando el error verdadero (por ejemplo, que el
 * usuario habia denegado el permiso) y era lo unico que veia el portero.
 */
export async function startQrCamera({ elementId, onDecoded }) {
  // Apagamos cualquier camara que haya quedado viva de un arranque anterior.
  // Limpiar el DOM no alcanza: la instancia huerfana sigue reteniendo el
  // stream, y esa es la que hace que queden "dos camaras activas".
  await destroyQrScanner(instanciaViva);

  // [fuente de video, config]. `null` = enumerar camaras y elegir la trasera.
  const intentos = [
    [HD_REAR,                       SCAN_CONFIG],
    [{ facingMode: 'environment' }, SCAN_CONFIG],
    [null,                          SCAN_CONFIG],
    [null,                          FALLBACK_CONFIG],
  ];

  let lastErr = null;

  for (const [fuente, config] of intentos) {
    // Antes de CADA intento, no solo del primero: si el anterior dejo su
    // <video> colgado, sin esto el intento que funcione lo apila abajo.
    limpiarContenedor(elementId);
    const html5 = createQrScanner(elementId);
    try {
      let src = fuente;
      if (src === null) {
        const cams = await Html5Qrcode.getCameras();
        if (!cams?.length) {
          await destroyQrScanner(html5);
          return { ok: false, error: 'No se detectó ninguna cámara en este dispositivo.' };
        }
        const back = cams.find(c => /back|rear|tras|environment/i.test(c.label || ''))
                  || cams[cams.length - 1];
        src = back.id;
      }
      await html5.start(src, config, onDecoded, () => {});
      instanciaViva = html5;
      // Este es el preview bueno: lo marcamos ANTES de barrer, para no
      // confundirlo con un resto que aparezca despues.
      videoVivo = contenedor(elementId)?.querySelector('video') || null;
      dejarUnSoloPreview(elementId);
      vigilarPreviewsDuplicados(elementId);
      await tryContinuousFocus(html5);
      return { ok: true, scanner: html5 };
    } catch (err) {
      await destroyQrScanner(html5);
      lastErr = err;
      if (esFatal(err)) break;
    }
  }

  return { ok: false, error: friendlyCamError(lastErr) };
}
