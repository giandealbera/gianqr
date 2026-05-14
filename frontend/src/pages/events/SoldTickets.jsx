import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Layout from '../../components/Layout';

const STATUS_BADGE = {
  pagado:    'bg-green-900 text-green-300',
  pendiente: 'bg-yellow-900 text-yellow-300',
  usado:     'bg-blue-900 text-blue-300',
  cancelado: 'bg-red-900 text-red-300',
};

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);

const SoldTickets = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [event, setEvent]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showMoney, setShowMoney] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get(`/events/${id}`),
      api.get(`/tickets?event_id=${id}`),
    ]).then(([ev, tk]) => {
      setEvent(ev.data);
      setTickets(tk.data);
    }).finally(() => setLoading(false));
  }, [id]);

  const filtered = tickets.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.buyer_name?.toLowerCase().includes(q) ||
             t.buyer_email?.toLowerCase().includes(q) ||
             t.qr_code?.toLowerCase().includes(q);
    }
    return true;
  });

  const totalRevenue = filtered.reduce((acc, t) => acc + (t.status === 'pagado' ? parseFloat(t.amount_paid || 0) : 0), 0);

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-4xl mx-auto">
        <button onClick={() => navigate(`/evento/${id}`)} className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1">
          ← {event?.name || 'Volver'}
        </button>

        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold">📋 Entradas vendidas</h1>
          <button
            onClick={() => setShowMoney(!showMoney)}
            className="text-gray-500 hover:text-gray-300 transition-colors bg-gray-800/50 p-1.5 rounded-lg text-sm"
          >
            {showMoney ? '👁️' : '🔒'}
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-5">{event?.name}</p>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="card text-center py-3">
            <p className="text-xl font-bold text-white">{tickets.length}</p>
            <p className="text-[10px] text-gray-500 uppercase">Total</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-xl font-bold text-green-400">{tickets.filter(t => t.status === 'pagado').length}</p>
            <p className="text-[10px] text-gray-500 uppercase">Pagadas</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-xl font-bold text-blue-400">{tickets.filter(t => t.status === 'usado').length}</p>
            <p className="text-[10px] text-gray-500 uppercase">Usadas</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-xl font-bold text-brand">{showMoney ? fmt(totalRevenue) : '$ •••••'}</p>
            <p className="text-[10px] text-gray-500 uppercase">Recaudado</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Buscar por nombre, email o QR..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input flex-1"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="">Todos</option>
            <option value="pagado">Pagado</option>
            <option value="pendiente">Pendiente</option>
            <option value="usado">Usado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        {/* Ticket list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {search || statusFilter ? 'No se encontraron entradas' : 'No hay entradas vendidas'}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => (
              <div key={t.id} className="card flex items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{t.buyer_name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[t.status]}`}>
                      {t.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {t.buyer_email} · {t.tipo_entrada}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-green-400">{showMoney ? fmt(t.amount_paid) : '***'}</p>
                  <p className="text-[10px] text-gray-600 font-mono">{t.qr_code}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SoldTickets;
