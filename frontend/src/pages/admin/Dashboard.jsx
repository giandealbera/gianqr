import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';

const StatCard = ({ label, value, sub, color = 'text-white' }) => (
  <div className="card">
    <p className="text-sm text-gray-400">{label}</p>
    <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
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
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Eventos activos" value={upcomingEvents.length} color="text-brand" />
          <StatCard label="Entradas vendidas (total)" value={totalSold} color="text-green-400" />
          <StatCard label="Total de eventos" value={events.length} />
        </div>

        {/* Próximos eventos */}
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Próximos eventos</h2>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : upcomingEvents.length === 0 ? (
            <p className="text-gray-500">No hay eventos próximos. ¡Creá uno!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800">
                    <th className="text-left pb-2">Evento</th>
                    <th className="text-left pb-2">Sala</th>
                    <th className="text-left pb-2">Fecha</th>
                    <th className="text-left pb-2">Hora</th>
                    <th className="text-right pb-2">Vendidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {upcomingEvents.map(ev => (
                    <tr key={ev.id} className="hover:bg-gray-800/50">
                      <td className="py-3 font-medium">{ev.name}</td>
                      <td className="py-3 text-gray-400">{ev.venue_name || '—'}</td>
                      <td className="py-3 text-gray-400">{new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR')}</td>
                      <td className="py-3 text-gray-400">{ev.start_time?.slice(0,5)}</td>
                      <td className="py-3 text-right text-green-400">{ev.tickets_sold || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
