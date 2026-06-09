import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Banner sutil arriba de la pantalla cuando el browser reporta offline.
// Antes una caida de red se veia como "Error al cargar" en cada accion,
// sin que el usuario supiera que el problema era la conexion. Ahora se
// ve un cartel claro y todas las acciones siguen lanzando sus toasts
// normales (no tapamos errores).
//
// El evento 'online'/'offline' del browser es heuristico — un wifi pelado
// no necesariamente dispara offline. Sirve para los casos obvios (modo
// avion, datos caidos).
const OfflineBanner = () => {
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);

  useEffect(() => {
    const goOff = () => setOffline(true);
    const goOn  = () => setOffline(false);
    window.addEventListener('offline', goOff);
    window.addEventListener('online',  goOn);
    return () => {
      window.removeEventListener('offline', goOff);
      window.removeEventListener('online',  goOn);
    };
  }, []);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          key="offline-banner"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -30, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed left-0 right-0 top-0 z-[70] pt-safe text-center text-xs font-medium py-1.5 safe-area-x inline-flex items-center justify-center gap-2"
          style={{ background: '#7F1D1D', color: '#FECACA', borderBottom: '1px solid #991B1B' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
            <path d="M3 3l18 18" />
          </svg>
          Sin conexión — las acciones pueden fallar hasta que vuelva la red
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
