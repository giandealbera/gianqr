import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import { porcentaje, anchoBarra } from '../../lib/percent';
import toast from 'react-hot-toast';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);
const METHOD_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia' };

const EventStats = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [buyer, setBuyer] = useState(null);
  const [loading, setLoading] = useState(true);

  // Curva de ventas: cuanto se vendio dia por dia entre dos fechas. El tramo
  // arranca por defecto en la apertura de venta (el "dia de anuncio") y llega
  // hasta hoy, pero se puede mover para comparar el mismo tramo contra otros
  // eventos: "del anuncio al miercoles vendi X".
  const [curva, setCurva] = useState(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tiposSel, setTiposSel] = useState([]);   // vacio = todos
  const [cargandoCurva, setCargandoCurva] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/events/${id}`),
      api.get(`/events/${id}/stats`).catch(() => ({ data: null })),
      api.get(`/tickets?event_id=${id}`).catch(() => ({ data: [] })),
      api.get(`/events/${id}/buyer-stats`).catch(() => ({ data: null })),
    ]).then(([ev, st, tk, by]) => {
      setEvent(ev.data);
      setStats(st.data);
      setTickets(tk.data);
      setBuyer(by.data);
    }).finally(() => setLoading(false));
  }, [id]);

  // Primera carga de la curva: sin fechas, el backend usa la apertura de venta.
  useEffect(() => {
    api.get(`/events/${id}/ventas-por-dia`)
      .then(r => { setCurva(r.data); setDesde(r.data.desde); setHasta(r.data.hasta); })
      .catch(() => {});
  }, [id]);

  const recargarCurva = async () => {
    setCargandoCurva(true);
    try {
      const p = new URLSearchParams();
      if (desde) p.set('desde', desde);
      if (hasta) p.set('hasta', hasta);
      if (tiposSel.length) p.set('tipos', tiposSel.join(','));
      const r = await api.get(`/events/${id}/ventas-por-dia?${p}`);
      setCurva(r.data);
    } catch (e) {
      toast.error(e.response?.data?.error || 'No se pudo calcular el período');
    } finally {
      setCargandoCurva(false);
    }
  };

  const alternarTipo = (ttId) =>
    setTiposSel(prev => prev.includes(ttId) ? prev.filter(x => x !== ttId) : [...prev, ttId]);

  if (loading) return (
    <Layout>
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand" />
      </div>
    </Layout>
  );

  // Compute analytics
  const paidTickets = tickets.filter(t => t.status === 'pagado' || t.status === 'usado');
  const totalRevenue = paidTickets.reduce((acc, t) => acc + parseFloat(t.amount_paid || 0), 0);
  
  // By payment method
  const byMethod = {};
  paidTickets.forEach(t => {
    const m = t.payment_method || 'otro';
    if (!byMethod[m]) byMethod[m] = { count: 0, total: 0 };
    byMethod[m].count++;
    byMethod[m].total += parseFloat(t.amount_paid || 0);
  });

  // By hour
  const byHour = {};
  paidTickets.forEach(t => {
    const h = t.created_at ? new Date(t.created_at).getHours() : 0;
    const key = `${String(h).padStart(2, '0')}:00`;
    if (!byHour[key]) byHour[key] = 0;
    byHour[key]++;
  });
  const sortedHours = Object.entries(byHour).sort((a, b) => a[0].localeCompare(b[0]));
  const maxHourCount = Math.max(...sortedHours.map(([, v]) => v), 1);

  // By day
  const byDay = {};
  paidTickets.forEach(t => {
    const d = t.created_at?.split(' ')[0] || t.created_at?.split('T')[0] || 'desconocido';
    if (!byDay[d]) byDay[d] = { count: 0, total: 0 };
    byDay[d].count++;
    byDay[d].total += parseFloat(t.amount_paid || 0);
  });
  const sortedDays = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-4xl mx-auto">
        <button onClick={() => navigate(`/evento/${id}`)} className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1">
          ← {event?.name || 'Volver'}
        </button>

        <h1 className="text-xl font-semibold mb-1 tracking-tight">Analíticas</h1>
        <p className="text-sm text-gray-400 mb-6">{event?.name}</p>

        {/* Big numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card text-center py-4 bg-gradient-to-br from-brand/10 to-transparent border-brand/20">
            <p className="text-3xl font-black text-brand">{paidTickets.length}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Entradas vendidas</p>
          </div>
          <div className="card text-center py-4">
            <p className="stat-num font-black text-green-400">{fmt(totalRevenue)}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Recaudado</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-3xl font-black text-blue-400">{stats?.totals?.total_usados || 0}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Ingresaron</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-3xl font-black text-yellow-400">{stats?.totals?.total_pendientes || 0}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Pendientes</p>
          </div>
        </div>

        {/* By payment method */}
        <div className="card mb-6">
          <h3 className="font-semibold text-sm mb-4">Por método de pago</h3>
          {Object.entries(byMethod).length === 0 ? (
            <p className="text-sm text-gray-500">Sin ventas aún</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(byMethod).map(([method, data]) => (
                <div key={method} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{METHOD_LABEL[method] || method}</span>
                    <span className="text-xs text-gray-500">{data.count} entradas</span>
                  </div>
                  <span className="font-semibold text-green-400">{fmt(data.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By ticket type */}
        {stats?.by_type?.length > 0 && (
          <div className="card mb-6">
            <h3 className="font-semibold text-sm mb-4">Por tipo de entrada</h3>
            <div className="space-y-4">
              {stats.by_type.map((tt, i) => {
                const pct = porcentaje(tt.sold_count, tt.total_quota);
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <span className="text-sm text-gray-200">{tt.tipo}</span>
                        <span className="text-xs text-gray-500 ml-2">{fmt(tt.price)} c/u</span>
                      </div>
                      <span className="text-xs text-gray-400">{tt.sold_count}/{tt.total_quota} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${pct >= 90 ? 'bg-red-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-brand'}`}
                        style={{ width: anchoBarra(pct, 2) }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Recaudado: {fmt(tt.recaudado)} · Disponibles: {tt.disponibles}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ventas por dia en un tramo — para comparar contra otros eventos */}
        {curva && (
          <div className="card mb-6">
            <h3 className="font-semibold text-sm mb-1">Ventas por día</h3>
            <p className="text-xs text-gray-500 mb-4">
              Cuánto se vendió entre dos fechas. Arranca en la apertura de venta;
              cambiá el tramo para comparar contra otros eventos.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>Desde</label>
                <input type="date" className="input text-sm" value={desde}
                       onChange={e => setDesde(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: '#6B7280' }}>Hasta</label>
                <input type="date" className="input text-sm" value={hasta}
                       onChange={e => setHasta(e.target.value)} />
              </div>
            </div>

            {/* Filtro por tipo: ninguno marcado = todos */}
            {(curva.tipos_disponibles || []).length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: '#6B7280' }}>
                  Tipo de entrada {tiposSel.length === 0 && '(todas)'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {curva.tipos_disponibles.map(tt => {
                    const activo = tiposSel.includes(tt.id);
                    return (
                      <button key={tt.id} type="button" onClick={() => alternarTipo(tt.id)}
                        className="text-xs px-2.5 py-1 rounded-full font-medium transition-colors"
                        style={activo
                          ? { background: '#C9974D', color: '#0B0F14' }
                          : { background: '#161B24', color: '#9AA3B2', border: '1px solid #1E2530' }}>
                        {tt.name}
                      </button>
                    );
                  })}
                  {tiposSel.length > 0 && (
                    <button type="button" onClick={() => setTiposSel([])}
                      className="text-xs px-2.5 py-1 rounded-full" style={{ color: '#6B7280' }}>
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
            )}

            <button onClick={recargarCurva} disabled={cargandoCurva}
                    className="btn-secondary w-full text-sm py-2 mb-4 disabled:opacity-50">
              {cargandoCurva ? 'Calculando…' : 'Ver período'}
            </button>

            <div className="rounded-lg p-3 mb-4 flex items-baseline justify-between"
                 style={{ background: '#161B24', border: '1px solid #1E2530' }}>
              <span className="text-xs" style={{ color: '#6B7280' }}>
                Vendidas en el período
                {curva.tipos_filtrados?.length > 0 && ' (tipos filtrados)'}
              </span>
              <span className="stat-num-sm font-black" style={{ color: '#C9974D' }}>
                {curva.total}
              </span>
            </div>

            {curva.total === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: '#4B5563' }}>
                No hubo ventas en ese período
              </p>
            ) : (() => {
              const maxDia = Math.max(...curva.dias.map(d => d.vendidas), 1);
              return (
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-1 h-32"
                       style={{ minWidth: `${Math.max(curva.dias.length * 22, 240)}px` }}>
                    {curva.dias.map(d => (
                      <div key={d.dia} className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                           title={`${d.dia}: ${d.vendidas} vendidas · acumulado ${d.acumulado}`}>
                        <span className="text-[9px]" style={{ color: '#6B7280' }}>
                          {d.vendidas > 0 ? d.vendidas : ''}
                        </span>
                        <div className="w-full rounded-t transition-all"
                             style={{ height: `${(d.vendidas / maxDia) * 100}%`,
                                      minHeight: d.vendidas > 0 ? '4px' : '1px',
                                      background: d.vendidas > 0 ? '#C9974D' : '#1E2530' }} />
                        <span className="text-[9px] whitespace-nowrap" style={{ color: '#4B5563' }}>
                          {d.dia.slice(8, 10)}/{d.dia.slice(5, 7)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Sales by hour */}
        {sortedHours.length > 0 && (
          <div className="card mb-6">
            <h3 className="font-semibold text-sm mb-4">Ventas por hora</h3>
            <div className="flex items-end gap-1 h-32">
              {sortedHours.map(([hour, count]) => (
                <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-400">{count}</span>
                  <div
                    className="w-full bg-brand/60 rounded-t min-h-[4px] transition-all"
                    style={{ height: `${(count / maxHourCount) * 100}%` }}
                  />
                  <span className="text-[10px] text-gray-500">{hour.split(':')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats demográficas (basadas en los datos que cargan los compradores) */}
        {buyer && buyer.total_compradores > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">Perfil del público</h3>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                {buyer.total_compradores} compradores
              </span>
            </div>

            {/* Edad: avg + buckets */}
            <div className="mb-5">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Edad promedio</span>
                <span className="text-xs text-gray-500">
                  {buyer.edad.muestra} de {buyer.total_compradores} cargaron edad ({buyer.edad.cobertura_pct}%)
                </span>
              </div>
              {buyer.edad.muestra > 0 ? (
                <>
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className="text-3xl font-black text-brand">{buyer.edad.promedio}</span>
                    <span className="text-sm text-gray-500">años · rango {buyer.edad.min}–{buyer.edad.max}</span>
                  </div>
                  <div className="space-y-1.5">
                    {buyer.edad.buckets.map(b => (
                      <div key={b.rango} className="flex items-center gap-3 text-xs">
                        <span className="w-12 text-gray-400">{b.rango}</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#161B24' }}>
                          <div className="h-full transition-all" style={{ width: anchoBarra(b.pct), background: '#C9974D' }} />
                        </div>
                        <span className="w-16 text-right text-gray-300 tabular-nums">{b.count} ({b.pct}%)</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-500">Ningún comprador cargó su edad aún.</p>
              )}
            </div>

            {/* Localidad */}
            <div className="mb-5 pt-4 border-t border-gray-800">
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Top localidades</span>
                <span className="text-xs text-gray-500">
                  {buyer.localidades.muestra} cargaron localidad ({buyer.localidades.cobertura_pct}%)
                </span>
              </div>
              {buyer.localidades.top.length > 0 ? (
                <div className="space-y-1.5">
                  {buyer.localidades.top.slice(0, 5).map((l, i) => (
                    <div key={l.nombre} className="flex items-center gap-3 text-sm">
                      <span className="w-5 text-center text-gray-500 text-xs">{i + 1}</span>
                      <span className="flex-1 text-gray-200 truncate">{l.nombre}</span>
                      <span className="text-gray-400 tabular-nums">{l.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Sin localidades cargadas.</p>
              )}
            </div>

            {/* Email coverage */}
            <div className="pt-4 border-t border-gray-800 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">Emails cargados</p>
                <p className="text-xs text-gray-500 mt-0.5">Útil para futuro marketing</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-400">{buyer.email.pct}%</p>
                <p className="text-xs text-gray-500">{buyer.email.count} de {buyer.total_compradores}</p>
              </div>
            </div>
          </div>
        )}

        {/* Sales by day */}
        {sortedDays.length > 1 && (
          <div className="card">
            <h3 className="font-semibold text-sm mb-3">Ventas por día</h3>
            <div className="space-y-2">
              {sortedDays.map(([day, data]) => (
                <div key={day} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">
                    {new Date(day + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500">{data.count} entradas</span>
                    <span className="font-semibold text-green-400">{fmt(data.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default EventStats;
