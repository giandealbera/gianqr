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
          className="fixed left-0 right-0 top-0 z-[70] pt-safe text-center text-xs font-medium py-1.5 safe-area-x"
          style={{ background: '#7F1D1D', color: '#FECACA', borderBottom: '1px solid #991B1B' }}
        >
          📡 Sin conexión — las acciones pueden fallar hasta que vuelva la red
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
