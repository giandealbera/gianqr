import { useEffect, useRef, useState } from 'react';

// Pull-to-refresh "tipo nativo" para listas largas. Aprovechamos que ya
// bloqueamos el PTR del browser con overscroll-behavior: none en html, asi
// que el unico que reacciona al tiron es este hook.
//
// Funciona solo cuando el scroll del documento esta en el top (sino se
// confunde con un swipe-down normal en medio de la lista). El umbral es
// 70px de pull desde el touchstart antes de disparar onRefresh.
//
// Devuelve { pulling, progress } para que el caller renderice un indicador
// visual proporcional al tiron (no obligatorio: si lo ignoras igual
// dispara onRefresh al soltar).
//
// Uso:
//   const { pulling, progress } = usePullToRefresh(async () => { await load(); });
export default function usePullToRefresh(onRefresh) {
  const [pulling,  setPulling]  = useState(false);
  const [progress, setProgress] = useState(0);
  const startY        = useRef(null);
  const triggeringRef = useRef(false);

  useEffect(() => {
    const THRESHOLD = 70;
    const MAX       = 110;

    const onTouchStart = (e) => {
      if (window.scrollY > 5) return;            // Solo cuenta si estamos arriba.
      if (triggeringRef.current) return;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {                              // Subio el dedo (no es PTR).
        setPulling(false);
        setProgress(0);
        return;
      }
      // Resistencia: el primer 50% del MAX se mueve 1:1, el resto se siente
      // pesado (sqrt) — sensacion natural tipo iOS.
      const eff = dy < MAX/2 ? dy : MAX/2 + Math.sqrt(dy - MAX/2) * 6;
      setPulling(true);
      setProgress(Math.min(eff / THRESHOLD, 1.4));
    };

    const onTouchEnd = async () => {
      if (startY.current == null) return;
      const shouldFire = progress >= 1 && !triggeringRef.current;
      startY.current = null;
      setPulling(false);
      setProgress(0);
      if (shouldFire) {
        triggeringRef.current = true;
        try { await onRefresh?.(); } catch { /* el caller maneja */ }
        triggeringRef.current = false;
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove',  onTouchMove,  { passive: true });
    document.addEventListener('touchend',   onTouchEnd);
    document.addEventListener('touchcancel',onTouchEnd);

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove',  onTouchMove);
      document.removeEventListener('touchend',   onTouchEnd);
      document.removeEventListener('touchcancel',onTouchEnd);
    };
  }, [onRefresh, progress]);

  return { pulling, progress };
}
