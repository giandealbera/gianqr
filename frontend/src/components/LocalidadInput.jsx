import { useEffect, useRef, useState } from 'react';

// Input de ciudad con autocompletado a partir de las ciudades ya cargadas
// en el sistema. Evita que "firmat", "Firmat" y "FIRMAT" queden como 3
// ciudades distintas en los reportes — el comprador toca la sugerencia y
// queda exacta.
//
// Llama al endpoint publico /api/public/localidades?q=... con debounce.
// Si el comprador prefiere escribir algo nuevo, no lo bloquea — solo
// sugiere. El backend igual normaliza al guardar (title-case).
//
// Props:
//   value, onChange — controlled input.
//   placeholder    — texto del placeholder.
//   backend        — base URL del API (mismo que usa PublicBuy).

const LocalidadInput = ({ value, onChange, placeholder = 'San Juan', backend }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [open,        setOpen]        = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  // Debounce 250ms para no hacer un fetch por cada tecla.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = (value || '').trim();
    if (q.length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${backend}/public/localidades?q=${encodeURIComponent(q)}`);
        if (!r.ok) return;
        const data = await r.json();
        const items = (data.items || []).filter(c => c.toLowerCase() !== q.toLowerCase());
        setSuggestions(items);
      } catch { /* silencioso — autocomplete es opcional */ }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [value, backend]);

  // Cerrar al tocar afuera.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('touchstart', onDocDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('touchstart', onDocDown);
    };
  }, [open]);

  const pick = (city) => {
    onChange(city);
    setOpen(false);
    setHighlighted(-1);
    // Devuelvo el foco al input para que el usuario siga si quiere.
    setTimeout(() => inputRef.current?.blur(), 0);
  };

  const onKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlighted >= 0) {
      e.preventDefault();
      pick(suggestions[highlighted]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && suggestions.length > 0;

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlighted(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="address-level2"
        enterKeyHint="done"
      />
      {showList && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-20 shadow-lg"
          style={{ background: '#0F141B', border: '1px solid #1E2530' }}
        >
          {suggestions.map((c, i) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // que no roben el foco antes del pick
              onClick={() => pick(c)}
              onMouseEnter={() => setHighlighted(i)}
              className="w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2"
              style={{
                background: i === highlighted ? 'rgba(201,151,77,0.1)' : 'transparent',
                color: i === highlighted ? '#C9974D' : '#E8EAF0',
              }}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                   strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6B7280' }}>
                <path d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocalidadInput;
