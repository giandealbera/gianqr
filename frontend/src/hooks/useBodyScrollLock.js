import { useEffect } from 'react';

// Bloquea el scroll del body mientras `locked` sea true. Util para modales
// y bottom-sheets — sin esto el body sigue scrolleando detras del backdrop
// y queda raro en mobile. Restaura el overflow original al desmontar.
//
// Uso:
//   const [open, setOpen] = useState(false);
//   useBodyScrollLock(open);
export default function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [locked]);
}
