import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import { useConfirm } from '../../context/ConfirmContext';
import { Icon } from '../../components/Icon';
import { porcentaje, anchoBarra } from '../../lib/percent';
import toast from 'react-hot-toast';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);
// Version sin centavos para los numeros grandes del tablero: "$ 1.850.000"
// en vez de "$ 1.850.000,00". Los centavos no aportan nada mirando el aforo
// y son 3 caracteres que hacian desbordar la tarjeta en el celular.
const fmtCorto = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
}).format(n || 0);
const REFRESH_MS = 3000;
// Cada cuantas vueltas de refresco recargamos el listado completo de
// entradas (la llamada cara). 4 x 3s = cada 12 segundos.
const TICKETS_CADA = 4;

const LiveControl = () => {
  const confirm = useConfirm();
  const [events,    setEvents]    = useState([]);
  const [eventSel,  setEventSel]  = useState('');
  const [stats,     setStats]     = useState(null);
  const [tickets,   setTickets]   = useState([]);
  const [filter,    setFilter]    = useState('todos');  // todos | ingreso | pendiente
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [lastUpd,   setLastUpd]   = useState(null);
  const [pulse,     setPulse]     = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    api.get('/events').then(r => {
      const list = r.data.filter(e => e.is_active);
      setEvents(list);
      // Auto-seleccionar el evento mas proximo
      if (list.length > 0 && !eventSel) {
        const sorted = [...list].sort((a, b) => new Date(a.date) - new Date(b.date));
        setEventSel(sorted[0].id);
      }
      setLoading(false);
    }).catch(() => { toast.error('Error al cargar eventos'); setLoading(false); });
  }, []);

  // El listado de entradas es la parte cara: trae hasta 5000 filas completas.
  // Los contadores de arriba (stats) son cuatro numeros. Antes pediamos las
  // dos cosas cada 3 segundos: 40 pedidos por minuto y varios MB por hora en
  // el 4G del celular. Ahora los contadores siguen al ritmo de siempre y el
  // listado se actualiza cada 12s (cada 4 vueltas), que para una tabla de
  // control es mas que suficiente.
  const vueltaRef = useRef(0);

  const refresh = async (evId, { incluirEntradas = false } = {}) => {
    if (!evId) return;
    try {
      const pedidos = [api.get(`/events/${evId}/stats`)];
      if (incluirEntradas) pedidos.push(api.get(`/tickets?event_id=${evId}`));

      const [statsRes, tickRes] = await Promise.all(pedidos);
      setStats(statsRes.data);
      if (tickRes) setTickets(tickRes.data);
      setLastUpd(new Date());
      // Pulsar el indicador
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    } catch {
      // si falla, no spamear toasts cada 3s
    }
  };

  // Auto-refresh. Pausa cuando la pestaña esta oculta para no quemar
  // bandwidth/bateria en mobile + bajar carga de DB. Al volver al foreground
  // hace un refresh inmediato para que el usuario no vea data vieja.
  useEffect(() => {
    if (!eventSel) return;
    let cancelled = false;

    const startPolling = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(() => {
        if (document.visibilityState !== 'visible' || cancelled) return;
        vueltaRef.current += 1;
        // El listado pesado solo cada TICKETS_CADA vueltas.
        refresh(eventSel, { incluirEntradas: vueltaRef.current % TICKETS_CADA === 0 });
      }, REFRESH_MS);
    };
    const stopPolling = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // La primera carga y la vuelta desde segundo plano si traen el listado:
    // ahi el usuario necesita ver la tabla al dia de una.
    refresh(eventSel, { incluirEntradas: true });
    startPolling();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        refresh(eventSel, { incluirEntradas: true });
        startPolling();
      } else {
        stopPolling();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      stopPolling();
    };
  }, [eventSel]);

  const handleDelete = async (t) => {
    const nombre = `${t.buyer_name} ${t.buyer_apellido || ''}`.trim();
    const ok = await confirm({
      title: `Eliminar entrada de ${nombre}`,
      message: `QR: ${t.qr_code}\nSe libera el cupo y se borra el registro.`,
      confirmText: 'Eliminar',
      dangerous: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/tickets/${t.id}`);
      toast.success('Entrada eliminada');
      // Recargamos el listado si o si: el usuario acaba de borrar una fila y
      // tiene que verla desaparecer, no esperar a la proxima vuelta pesada.
      refresh(eventSel, { incluirEntradas: true });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    }
  };

  // Filtros
  const filtered = tickets.filter(t => {
    if (filter === 'ingreso'   && t.status !== 'usado') return false;
    if (filter === 'pendiente' && t.status === 'usado') return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${t.buyer_name || ''} ${t.buyer_apellido || ''} ${t.buyer_email || ''} ${t.buyer_localidad || ''} ${t.qr_code || ''} ${t.generado_por || ''} ${t.vendedor_nombre || ''} ${t.vendedor_code || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const totals = stats?.totals || {};
  // Number() explicito: Postgres devuelve los COUNT como texto y sumar dos
  // conteos sin convertir los CONCATENA ("164" + "50" = "16450" entradas en
  // vez de 214). En SQLite vienen como numero, por eso no se ve en desarrollo.
  const num = (v) => Number(v) || 0;
  const ingresaron = num(totals.total_usados);
  const pagados    = num(totals.total_pagados);
  const totalEntradas = ingresaron + pagados; // todos los validos
  const pct = porcentaje(ingresaron, totalEntradas);

  const selectedEv = events.find(e => e.id === eventSel);

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-6xl mx-auto">

        {/* Header con indicador live */}
        <div className="flex items-start justify-between mb-1 gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight flex items-center gap-3">
              Control en vivo
              <span className="flex items-center gap-1.5 text-xs font-normal">
                <span className={`w-2 h-2 rounded-full ${pulse ? 'bg-green-400 animate-ping' : 'bg-green-500'}`} />
                <span style={{ color: '#6B7280' }}>EN VIVO</span>
              </span>
            </h1>
            {lastUpd && (
              <p className="text-xs" style={{ color: '#4B5563' }}>
                Actualizado {lastUpd.toLocaleTimeString('es-AR')}
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand" />
          </div>
        ) : (
          <>
            {/* Selector de evento */}
            <div className="mb-6 mt-4">
              <label className="text-xs uppercase tracking-widest font-semibold mb-2 block" style={{ color: '#6B7280' }}>
                Evento
              </label>
              <select className="input max-w-md" value={eventSel}
                      onChange={e => setEventSel(e.target.value)}>
                <option value="">Selecciona evento</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} — {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR')}
                  </option>
                ))}
              </select>
            </div>

            {!eventSel ? (
              <p className="text-center py-12 text-sm" style={{ color: '#4B5563' }}>
                Elegi un evento para ver el control en vivo
              </p>
            ) : (
              <>
                {/* Counters grandes */}
                {/* min-w-0 en cada tarjeta: sin eso las columnas de la grilla
                    toman el ancho del contenido y un numero largo empuja la
                    tarjeta fuera de la pantalla en vez de achicarse.
                    Los tamaños arrancan chicos y crecen con la pantalla. */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="card text-center py-6 min-w-0">
                    <p className="text-4xl sm:text-5xl font-black text-emerald-400 tabular-nums leading-none">{ingresaron}</p>
                    <p className="text-[10px] uppercase tracking-wider mt-2" style={{ color: '#6B7280' }}>
                      Ingresaron
                    </p>
                  </div>
                  <div className="card text-center py-6 min-w-0">
                    <p className="text-4xl sm:text-5xl font-black tabular-nums leading-none" style={{ color: '#C9974D' }}>{pagados}</p>
                    <p className="text-[10px] uppercase tracking-wider mt-2" style={{ color: '#6B7280' }}>
                      Pendientes ingreso
                    </p>
                  </div>
                  <div className="card text-center py-6 min-w-0">
                    <p className="text-4xl sm:text-5xl font-black tabular-nums leading-none">{totalEntradas}</p>
                    <p className="text-[10px] uppercase tracking-wider mt-2" style={{ color: '#6B7280' }}>
                      Total vendido
                    </p>
                  </div>
                  <div className="card text-center py-6 min-w-0">
                    <p className="text-xl sm:text-2xl md:text-3xl font-black tabular-nums leading-none break-words"
                       title={fmt(totals.total_recaudado)}>
                      {fmtCorto(totals.total_recaudado)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider mt-2" style={{ color: '#6B7280' }}>
                      Recaudado
                    </p>
                  </div>
                </div>

                {/* Progress bar de ingresos */}
                <div className="card mb-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#6B7280' }}>
                      Aforo actual
                    </span>
                    <span className="text-sm font-bold" style={{ color: '#C9974D' }}>{pct}%</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: '#1E2530' }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: anchoBarra(pct), background: 'linear-gradient(90deg, #34D399, #10B981)' }}
                    />
                  </div>
                  <p className="text-xs mt-2" style={{ color: '#6B7280' }}>
                    {ingresaron} de {totalEntradas} personas entraron
                  </p>
                </div>

                {/* Top vendedores ahora */}
                {tickets.length > 0 && (() => {
                  const byVendor = {};
                  for (const t of tickets) {
                    if (t.status !== 'pagado' && t.status !== 'usado') continue;
                    const k = t.vendedor_code || t.vendedor_nombre || 'Caja';
                    if (!byVendor[k]) byVendor[k] = { name: t.vendedor_nombre || 'Caja', code: t.vendedor_code, count: 0, total: 0 };
                    byVendor[k].count += 1;
                    byVendor[k].total += parseFloat(t.amount_paid || 0);
                  }
                  const top = Object.values(byVendor).sort((a, b) => b.count - a.count).slice(0, 5);
                  if (top.length === 0) return null;
                  return (
                    <div className="card mb-6">
                      <p className="text-xs uppercase tracking-widest font-semibold mb-3 inline-flex items-center gap-2" style={{ color: '#6B7280' }}>
                        <Icon name="trophy" className="w-3.5 h-3.5" />
                        Top vendedores del evento
                      </p>
                      <div className="space-y-2">
                        {top.map((v, i) => (
                          <div key={i} className="flex justify-between items-baseline text-sm">
                            <span className="flex items-center gap-2">
                              <span className="text-xs font-mono w-5" style={{ color: '#C9974D' }}>#{i + 1}</span>
                              <span className="font-medium">{v.name}</span>
                              {v.code && <span className="text-xs font-mono" style={{ color: '#6B7280' }}>({v.code})</span>}
                            </span>
                            <span className="text-right">
                              <span className="font-bold text-brand">{v.count}</span>
                              <span className="text-xs ml-2" style={{ color: '#6B7280' }}>{fmt(v.total)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Desglose por tipo */}
                {stats?.by_type?.length > 0 && (
                  <div className="card mb-6">
                    <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: '#6B7280' }}>
                      Por tipo de entrada
                    </p>
                    <div className="space-y-2">
                      {stats.by_type.map((tt, i) => {
                        const cap = tt.total_quota || 0;
                        const sold = tt.sold_count || 0;
                        const ttPct = porcentaje(sold, cap);
                        return (
                          <div key={i}>
                            <div className="flex justify-between items-baseline text-sm">
                              <span className="font-medium">{tt.tipo}</span>
                              <span className="text-xs" style={{ color: '#6B7280' }}>
                                {sold} / {cap} ({ttPct}%)
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: '#1E2530' }}>
                              <div className="h-full rounded-full" style={{ width: anchoBarra(ttPct), background: '#C9974D' }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Lista de personas */}
                <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                  <h2 className="text-lg font-bold">Personas ({filtered.length})</h2>
                  <div className="flex gap-2">
                    {[
                      { k: 'todos',     label: 'Todos' },
                      { k: 'ingreso',   label: 'Ingresaron' },
                      { k: 'pendiente', label: 'Pendientes' },
                    ].map(({ k, label }) => (
                      <button key={k} onClick={() => setFilter(k)}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                        style={filter === k
                          ? { background: '#C9974D', color: '#fff' }
                          : { background: '#1E2530', color: '#9CA3AF' }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="search"
                  enterKeyHint="search"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                  className="input mb-3"
                  placeholder="Buscar por nombre, email, localidad, codigo o quien lo generó..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />

                <div className="card overflow-x-auto p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left" style={{ background: '#0D1117', color: '#6B7280' }}>
                        <th className="py-3 px-3 font-medium">#</th>
                        <th className="py-3 px-3 font-medium">Nombre</th>
                        <th className="py-3 px-3 font-medium">Edad</th>
                        <th className="py-3 px-3 font-medium">Localidad</th>
                        <th className="py-3 px-3 font-medium">Email</th>
                        <th className="py-3 px-3 font-medium">Tipo</th>
                        <th className="py-3 px-3 font-medium">Generó</th>
                        <th className="py-3 px-3 font-medium">Estado</th>
                        <th className="py-3 px-3 font-medium">Ingreso</th>
                        <th className="py-3 px-3 font-medium">Codigo</th>
                        <th className="py-3 px-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={11} className="text-center py-8" style={{ color: '#4B5563' }}>
                          {tickets.length === 0 ? 'Sin entradas en este evento' : 'Sin resultados'}
                        </td></tr>
                      ) : (
                        filtered.map((t, i) => (
                          <tr key={t.id} className="border-t" style={{ borderColor: '#1E2530' }}>
                            <td className="py-3 px-3" style={{ color: '#4B5563' }}>{i + 1}</td>
                            <td className="py-3 px-3 font-medium">{t.buyer_name} {t.buyer_apellido || ''}</td>
                            <td className="py-3 px-3">{t.buyer_edad || '—'}</td>
                            <td className="py-3 px-3" style={{ color: '#9CA3AF' }}>{t.buyer_localidad || '—'}</td>
                            <td className="py-3 px-3 text-xs" style={{ color: '#9CA3AF' }}>{t.buyer_email || '—'}</td>
                            <td className="py-3 px-3" style={{ color: '#9CA3AF' }}>{t.tipo_entrada}</td>
                            <td className="py-3 px-3 text-xs" style={{ color: '#9CA3AF' }}>
                              {t.generado_por || t.vendedor_nombre || 'Caja'}
                              {t.vendedor_code && <span className="ml-1 font-mono" style={{ color: '#C9974D' }}>({t.vendedor_code})</span>}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`badge-${t.status}`}>{t.status}</span>
                            </td>
                            <td className="py-3 px-3 text-xs" style={{ color: '#6B7280' }}>
                              {t.scanned_at
                                ? new Date(t.scanned_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                            <td className="py-3 px-3 font-mono text-xs" style={{ color: '#C9974D' }}>{t.qr_code}</td>
                            <td className="py-3 px-3">
                              <button onClick={() => handleDelete(t)}
                                      className="text-xs text-red-400 hover:text-red-300 font-medium">
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default LiveControl;
