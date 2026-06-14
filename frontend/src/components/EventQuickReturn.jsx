import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getActiveEvent } from '../lib/activeEvent';

// Boton flotante de "volver al home del evento". Aparece cuando estas
// trabajando dentro del contexto de un evento (lo abriste y se guardo como
// activo) PERO estas en otra pantalla — Vender, Escanear, Reportes, Mas,
// la lista de Eventos. De un toque te lleva a /evento/:id (el home del
// evento) sin tener que ir a la lista y buscarlo.
//
// No aparece:
//  - Si nunca entraste a un evento (no hay activo).
//  - Si ya estas en el home del evento o en cualquiera de sus sub-pantallas
//    (/evento/:id/...), porque desde ahi ya tenes el boton "volver" propio.
const EventQuickReturn = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [active, setActive] = useState(getActiveEvent());

  // Re-leer en cada cambio de ruta + cuando se dispara el evento custom
  // (al entrar a un evento nuevo se actualiza el activo).
  useEffect(() => {
    const refresh = () => setActive(getActiveEvent());
    refresh();
    window.addEventListener('active-event-changed', refresh);
    return () => window.removeEventListener('active-event-changed', refresh);
  }, [location.pathname]);

  if (!active?.id) return null;
  // Oculto en el home del evento y sus sub-rutas (/evento/:id, /evento/:id/...).
  if (location.pathname.startsWith(`/evento/${active.id}`)) return null;

  return (
    <button
      onClick={() => navigate(`/evento/${active.id}`)}
      className="fixed z-50 flex items-center gap-2 rounded-full pl-3 pr-4 py-2.5 shadow-lg active:scale-95 transition-transform safe-area-x lg:hidden"
      style={{
        // Levantado sobre el bottom-nav (~64px) + safe-area del home indicator.
        bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))',
        right: '16px',
        background: 'linear-gradient(135deg, #C9974D, #A87B35)',
        color: '#0B0F14',
        boxShadow: '0 6px 24px rgba(201,151,77,0.35)',
        maxWidth: 'calc(100vw - 32px)',
      }}
      title={`Ir al evento: ${active.name}`}
    >
      {/* Icono casa */}
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"
           strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10" />
      </svg>
      <span className="text-sm font-semibold truncate">{active.name}</span>
    </button>
  );
};

export default EventQuickReturn;
