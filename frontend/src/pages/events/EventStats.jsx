import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Layout from '../../components/Layout';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);
const METHOD_LABEL = { mercadopago: '💳 MercadoPago', efectivo: '💵 Efectivo', transferencia: '🏦 Transferencia' };

const EventStats = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/events/${id}`),
      api.get(`/events/${id}/stats`).catch(() => ({ data: null })),
      api.get(`/tickets?event_id=${id}`).catch(() => ({ data: [] })),
    ]).then(([ev, st, tk]) => {
      setEvent(ev.data);
      setStats(st.data);
      setTickets(tk.data);
    }).finally(() => setLoading(false));
  }, [id]);

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

        <h1 className="text-xl font-bold mb-1">📊 Datos y analíticas</h1>
        <p className="text-sm text-gray-400 mb-6">{event?.name}</p>

        {/* Big numbers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card text-center py-4 bg-gradient-to-br from-brand/10 to-transparent border-brand/20">
            <p className="text-3xl font-black text-brand">{paidTickets.length}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Entradas vendidas</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-3xl font-black text-green-400">{fmt(totalRevenue)}</p>
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
                const pct = tt.total_quota > 0 ? Math.round((tt.sold_count / tt.total_quota) * 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-1">
                      <div>
                        <span className="text-sm text-gray-200">{tt.tipo}</span>
                        <span className="text-xs text-gray-500 ml-2">{fmt(tt.price)} c/u</span>
                      </div>
                      <span className="text-xs text-gray-400">{tt.sold_count}/{tt.total_quota} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2.5">
                      <div
                        className={`h-2.5 rounded-full transition-all duration-500 ${pct >= 90 ? 'bg-red-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-brand'}`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Recaudado: {fmt(tt.recaudado)} · Disponibles: {tt.disponibles}</p>
                  </div>
                );
              })}
            </div>
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
