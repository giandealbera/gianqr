import { useEffect, useRef } from 'react';

// Mantiene la pantalla prendida mientras el componente este montado y
// `active` sea true. Pensado para las pantallas de escaner del portero:
// estan escaneando 4 horas seguidas y si el celular se bloquea cada 30
// segundos pierden el flow. Screen Wake Lock API:
//   - iOS Safari 16.4+, Chrome Android, todos los browsers serios.
//   - Si el browser no soporta, falla silencioso (no se rompe nada).
//   - Cuando la tab pierde foco el sistema libera el lock automaticamente;
//     reapuntar al volver. Por eso hookeamos visibilitychange.
//   - HTTPS only en prod; en dev por localhost funciona igual.
export default function useWakeLock(active = true) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let released = false;

    const acquire = async () => {
      try {
        sentinelRef.current = await navigator.wakeLock.request('screen');
      } catch {
        // El browser puede rechazar si la tab no esta visible o por permisos.
        // No es bloqueante.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !released) acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (sentinelRef.current) {
        sentinelRef.current.release().catch(() => {});
        sentinelRef.current = null;
      }
    };
  }, [active]);
}
