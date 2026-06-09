import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';

// Numero grande + label chico arriba. font-semibold (no -bold) + tabular-nums
// dan una sensacion mas ejecutiva — menos "AI dashboard" — y los digitos
// alineados se ven mejor cuando hay grids de stats.
const StatCard = ({ label, value, sub, color = 'text-white' }) => (
  <div className="card">
    <p className="text-[11px] uppercase tracking-wider font-medium" style={{ color: '#6B7280' }}>{label}</p>
    <p className={`text-2xl font-semibold mt-1.5 tabular-nums ${color}`}>{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
  </div>
);

const Dashboard = () => {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/events').then(r => setEvents(r.data)).finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const upcomingEvents = events.filter(e => e.date >= today && e.is_active);
  const totalSold = events.reduce((acc, e) => acc + parseInt(e.tickets_sold || 0), 0);

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6">
        <h1 className="text-xl font-semibold tracking-tight text-white mb-6">Vista general</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <StatCard label="Eventos activos" value={upcomingEvents.length} color="text-brand" />
          <StatCard label="Entradas vendidas" value={totalSold.toLocaleString('es-AR')} color="text-emerald-400" />
          <StatCard label="Total de eventos" value={events.length} />
        </div>

        {/* Próximos eventos */}
        <div className="card">
          <h2 className="text-xs uppercase tracking-wider font-semibold mb-4" style={{ color: '#6B7280' }}>Próximos eventos</h2>
          {loading ? (
            <p className="text-gray-500 text-sm">Cargando…</p>
          ) : upcomingEvents.length === 0 ? (
            <p className="text-gray-500 text-sm">Sin eventos próximos</p>
          ) : (
            <div className="overflow-x-auto fade-in">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800" style={{ color: '#6B7280' }}>
                    <th className="text-left pb-2 text-[11px] uppercase tracking-wider font-medium">Evento</th>
                    <th className="text-left pb-2 text-[11px] uppercase tracking-wider font-medium">Fecha</th>
                    <th className="text-left pb-2 text-[11px] uppercase tracking-wider font-medium">Hora</th>
                    <th className="text-right pb-2 text-[11px] uppercase tracking-wider font-medium">Vendidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {upcomingEvents.map(ev => (
                    <tr key={ev.id} className="hover:bg-gray-800/50">
                      <td className="py-3 font-medium">{ev.name}</td>
                      <td className="py-3 text-gray-400 tabular-nums">{new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                      <td className="py-3 text-gray-400 tabular-nums">{ev.start_time?.slice(0,5)}</td>
                      <td className="py-3 text-right text-emerald-400 tabular-nums">{(ev.tickets_sold || 0).toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
