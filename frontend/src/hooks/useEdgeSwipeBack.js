import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isStandalone } from '../lib/share';

// Gesto "swipe-back" tipo iOS: tirar desde el borde izquierdo de la pantalla
// hacia la derecha vuelve atras. En Safari el gesto ya existe nativo, pero
// en la PWA standalone (que es como mas usan los porteros y vendedores)
// iOS NO lo provee — sin esto hay que usar el boton "←" de la app para
// volver, que rompe la sensacion de app nativa.
//
// Heuristica: el touchstart tiene que arrancar en los primeros 24px de la
// izquierda (zona "edge"), tiene que moverse > 80px horizontal y mas
// horizontal que vertical (sino confunde con scroll vertical).
//
// Solo se enciende en modo standalone para no pisar el back nativo del
// browser cuando la PWA no esta instalada.
export default function useEdgeSwipeBack() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isStandalone()) return;
    // En la raiz no hay "atras" — evitamos quedar en /login si el usuario
    // hace el gesto desde la home.
    if (location.pathname === '/' || location.pathname === '/eventos') return;

    let startX = null, startY = null, t0 = 0;
    const EDGE = 24;       // ancho de la zona desde la izquierda
    const DIST = 80;       // px horizontales para disparar
    const MAX_MS = 500;    // tiempo maximo del gesto

    const onStart = (e) => {
      const t = e.touches[0];
      if (t.clientX > EDGE) return;
      startX = t.clientX;
      startY = t.clientY;
      t0 = Date.now();
    };

    const onMove = (e) => {
      if (startX == null) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      // Si el movimiento ya pinta a scroll vertical, cancelamos.
      if (dy > Math.abs(dx)) { startX = null; return; }
    };

    const onEnd = (e) => {
      if (startX == null) return;
      const dt = Date.now() - t0;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      startX = null;
      if (dt > MAX_MS) return;
      if (dx >= DIST && dx > dy) navigate(-1);
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove',  onMove,  { passive: true });
    document.addEventListener('touchend',   onEnd);
    document.addEventListener('touchcancel',onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove',  onMove);
      document.removeEventListener('touchend',   onEnd);
      document.removeEventListener('touchcancel',onEnd);
    };
  }, [navigate, location.pathname]);
}
