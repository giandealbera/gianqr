import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Reemplazo de window.confirm: bottom-sheet en mobile, modal centrado en
// desktop, respeta el tema oscuro de la app, soporta titulos multi-linea y
// un tono "peligroso" para acciones destructivas (rojo). Uso:
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: 'Eliminar entrada', message: '...', confirmText: 'Eliminar', dangerous: true }))) return;
//   // ... seguir con el delete
//
// La api es identica a Promise<bool> asi reemplaza window.confirm 1:1 sin
// reescribir el flujo del caller.

const ConfirmContext = createContext(null);

const DEFAULTS = {
  title:       '¿Estás seguro?',
  message:     '',
  confirmText: 'Confirmar',
  cancelText:  'Cancelar',
  dangerous:   false,
};

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState({ open: false, ...DEFAULTS });
  const resolverRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise(resolve => {
      resolverRef.current = resolve;
      setState({ open: true, ...DEFAULTS, ...options });
    });
  }, []);

  const close = (result) => {
    setState(s => ({ ...s, open: false }));
    const r = resolverRef.current;
    resolverRef.current = null;
    if (r) r(result);
  };

  // ESC cierra como cancelar — comportamiento esperado en desktop.
  useEffect(() => {
    if (!state.open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter')  close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.open]);

  // Lock del scroll del body mientras hay modal abierto. Sin esto el body
  // sigue scrolleando detras del backdrop y queda raro en mobile.
  useEffect(() => {
    if (!state.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [state.open]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {state.open && (
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => close(false)}
            className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              key="confirm-card"
              initial={{ y: 40, opacity: 0, scale: 0.98 }}
              animate={{ y: 0,  opacity: 1, scale: 1 }}
              exit={{    y: 40, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-sm pb-safe"
              style={{
                background:  '#0F141B',
                border:      '1px solid #1E2530',
                borderRadius: '20px 20px 0 0',
                color:       '#E8EAF0',
              }}
            >
              {/* Drag handle visual en mobile (puramente cosmetico). */}
              <div className="flex justify-center pt-2 sm:hidden">
                <span className="w-10 h-1 rounded-full" style={{ background: '#2A3340' }} />
              </div>

              <div className="p-5 sm:p-6">
                <h3 className="font-bold text-base mb-2" style={{ color: state.dangerous ? '#FCA5A5' : '#E8EAF0' }}>
                  {state.title}
                </h3>
                {state.message && (
                  <p className="text-sm whitespace-pre-line leading-relaxed" style={{ color: '#9AA3B2' }}>
                    {state.message}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 mt-5">
                  <button
                    type="button"
                    onClick={() => close(false)}
                    className="py-3 rounded-xl font-medium text-sm transition-colors"
                    style={{ background: '#161B24', border: '1px solid #1E2530', color: '#E8EAF0' }}
                  >
                    {state.cancelText}
                  </button>
                  <button
                    type="button"
                    onClick={() => close(true)}
                    autoFocus
                    className="py-3 rounded-xl font-semibold text-sm transition-colors"
                    style={state.dangerous
                      ? { background: '#B91C1C', color: '#FFFFFF' }
                      : { background: '#C9974D', color: '#0B0F14' }}
                  >
                    {state.confirmText}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>');
  return ctx;
};

// Helper sin hook para callers que NO son componentes React (eg utils).
// Se setea desde el provider via window.__confirm. Uso muy puntual.
