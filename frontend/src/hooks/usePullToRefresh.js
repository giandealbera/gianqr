import { useCallback, useEffect, useRef, useState } from 'react';

// Pull-to-refresh "tipo nativo" para listas largas. Aprovechamos que ya
// bloqueamos el PTR del browser con overscroll-behavior: none en html, asi
// que el unico que reacciona al tiron es este hook.
//
// Funciona solo cuando el scroll del documento esta en el top (sino se
// confunde con un swipe-down normal en medio de la lista). El umbral es
// 70px de pull desde el touchstart antes de disparar onRefresh.
//
// Devuelve { pulling, progress, refreshing } para que el caller renderice un
// indicador (ver PullIndicator). Si los ignora, igual dispara onRefresh.
//
// Uso:
//   const { pulling, progress, refreshing } = usePullToRefresh(() => load());
//   ...
//   <PullIndicator pulling={pulling} progress={progress} refreshing={refreshing} />
//
// Tres cosas que antes faltaban y hacian que se sintiera a web:
//
//   1. No se llamaba preventDefault (el listener era passive), asi que el
//      navegador seguia tratando el tiron como scroll y la pagina peleaba
//      contra el gesto. Ahora, una vez que sabemos que es un tiron hacia
//      abajo estando arriba de todo, lo frenamos.
//   2. El efecto dependia de `progress`, asi que re-suscribia los cuatro
//      listeners en CADA frame del arrastre. Ahora el progreso vive en un
//      ref y los listeners se montan una sola vez.
//   3. Al soltar, el indicador desaparecia al instante y no habia ninguna
//      señal de que se estaba actualizando: parecia que el gesto no habia
//      hecho nada. Ahora queda el estado `refreshing` hasta que termina.
export default function usePullToRefresh(onRefresh) {
  const [pulling,    setPulling]    = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startY      = useRef(null);
  const progressRef = useRef(0);        // el valor "vivo", sin re-render
  const disparando  = useRef(false);

  // La funcion suele venir inline (`() => load()`), asi que la guardamos en un
  // ref para que los listeners no se re-suscriban en cada render.
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const setProg = useCallback((v) => {
    progressRef.current = v;
    setProgress(v);
  }, []);

  useEffect(() => {
    const THRESHOLD = 70;
    const MAX       = 110;

    const onTouchStart = (e) => {
      if (disparando.current) return;
      if (window.scrollY > 5) return;            // Solo cuenta si estamos arriba.
      if (e.touches.length !== 1) return;        // Pinch/zoom no es un tiron.
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e) => {
      if (startY.current == null || disparando.current) return;
      const dy = e.touches[0].clientY - startY.current;

      if (dy <= 0) {                              // Subio el dedo (no es PTR).
        setPulling(false);
        setProg(0);
        return;
      }
      // Si scrolleo mientras tanto, abortamos: era un scroll normal.
      if (window.scrollY > 5) {
        startY.current = null;
        setPulling(false);
        setProg(0);
        return;
      }

      // Resistencia: el primer 50% del MAX se mueve 1:1, el resto se siente
      // pesado (sqrt) — sensacion natural tipo iOS.
      const eff = dy < MAX / 2 ? dy : MAX / 2 + Math.sqrt(dy - MAX / 2) * 6;
      setPulling(true);
      setProg(Math.min(eff / THRESHOLD, 1.4));

      // Recien aca le sacamos el scroll al navegador: ya sabemos que es un
      // tiron hacia abajo estando arriba de todo.
      if (eff > 6 && e.cancelable) e.preventDefault();
    };

    const onTouchEnd = async () => {
      if (startY.current == null) return;
      const dispara = progressRef.current >= 1 && !disparando.current;
      startY.current = null;
      setPulling(false);
      setProg(0);

      if (!dispara) return;

      disparando.current = true;
      setRefreshing(true);
      // Vibracion corta: confirma que agarro el gesto sin tener que mirar.
      navigator.vibrate?.(8);
      try { await onRefreshRef.current?.(); }
      catch { /* el caller maneja su error */ }
      finally {
        disparando.current = false;
        setRefreshing(false);
      }
    };

    // passive:false en touchmove es imprescindible para poder preventDefault.
    document.addEventListener('touchstart',  onTouchStart, { passive: true });
    document.addEventListener('touchmove',   onTouchMove,  { passive: false });
    document.addEventListener('touchend',    onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);

    return () => {
      document.removeEventListener('touchstart',  onTouchStart);
      document.removeEventListener('touchmove',   onTouchMove);
      document.removeEventListener('touchend',    onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [setProg]);   // se monta una sola vez

  return { pulling, progress, refreshing };
}
