// Web Share API con fallback a clipboard. En iOS el share() abre el sheet
// nativo (WhatsApp, Mail, AirDrop, Mensajes, etc.) — mucho mejor UX que
// copiar y pegar manualmente en otra app.
//
// La Web Share API esta disponible en iOS Safari 12+, Chrome Android, Edge
// (no Firefox desktop). Si no esta disponible, copia al portapapeles y
// avisa con toast.
//
// Uso:
//   import { share } from '../lib/share';
//   await share({ title: 'Link de la entrada', text: 'Cargá tus datos:', url: 'https://...' });
import toast from 'react-hot-toast';

export async function share({ title, text, url } = {}) {
  // navigator.share solo existe sobre HTTPS (o localhost). En dev http
  // queda undefined y caemos al fallback.
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return { ok: true, method: 'native' };
    } catch (err) {
      // AbortError = usuario cerro el sheet sin compartir. NO es un error real.
      if (err && err.name === 'AbortError') return { ok: false, method: 'native', cancelled: true };
      // Cualquier otro error → fallback a clipboard.
    }
  }
  // Fallback clipboard. La mayoria de los callers ya tenian este flujo
  // antes — lo unificamos aca para que un sitio tenga una sola UX.
  try {
    if (url) await navigator.clipboard.writeText(url);
    toast.success('Link copiado');
    return { ok: true, method: 'clipboard' };
  } catch {
    toast.error('No se pudo compartir ni copiar el link');
    return { ok: false, method: null };
  }
}

// Detecta si la app esta corriendo como PWA standalone (instalada en home
// screen) o desde el browser. Util para mostrar tips de "instalar la app"
// solo cuando todavia no esta instalada.
export const isStandalone = () => {
  if (typeof window === 'undefined') return false;
  // iOS Safari: navigator.standalone (no esta en la spec, propio de Apple).
  // Android / desktop: matchMedia display-mode standalone.
  return Boolean(
    window.navigator?.standalone ||
    window.matchMedia?.('(display-mode: standalone)').matches
  );
};

// Heuristica iOS Safari (no Chrome iOS): vale para mostrar el tip
// especifico de "Compartir → Agregar al Home Screen", que solo aplica a
// Safari. Chrome iOS no tiene esa opcion.
export const isIosSafari = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /^((?!chrome|crios|fxios|opios|edgios).)*safari/i.test(ua);
  return isIOS && isSafari;
};
