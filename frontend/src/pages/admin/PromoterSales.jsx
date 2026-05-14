import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';

const PromoterSales = () => {
  const [sales, setSales] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventFilter, setEventFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/events').then(res => setEvents(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = eventFilter ? { event_id: eventFilter } : {};
    api.get('/users/promoter-sales', { params })
      .then(res => setSales(res.data))
      .catch(() => toast.error('Error al cargar ventas de promotores'))
      .finally(() => setLoading(false));
  }, [eventFilter]);

  const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);

  const totalVendidas = sales.reduce((acc, p) => acc + (p.total_vendidas || 0), 0);
  const totalRecaudado = sales.reduce((acc, p) => acc + (p.total_recaudado || 0), 0);
  const totalComisiones = sales.reduce((acc, p) => acc + (p.comision_promotor || 0), 0);
  const totalAEnviar = sales.reduce((acc, p) => acc + (p.debe_enviar || 0), 0);

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Ventas de Públicas</h1>
        <p className="text-gray-400 mb-6">Resumen del desempeño de tus promotores y liquidación de comisiones.</p>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <select
            value={eventFilter}
            onChange={e => setEventFilter(e.target.value)}
            className="input max-w-xs"
          >
            <option value="">Todos los eventos</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>

        {/* Global Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="card text-center py-4">
            <p className="text-3xl font-black text-white">{totalVendidas}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Vendidas por Públicas</p>
          </div>
          <div className="card text-center py-4">
            <p className="text-3xl font-black text-white">{fmt(totalRecaudado)}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Total Generado</p>
          </div>
          <div className="card text-center py-4 border-red-500/30 bg-red-900/10">
            <p className="text-3xl font-black text-red-400">{fmt(totalComisiones)}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Comisiones a pagar</p>
          </div>
          <div className="card text-center py-4 border-green-500/30 bg-green-900/10">
            <p className="text-3xl font-black text-green-400">{fmt(totalAEnviar)}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Neto para la org.</p>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left pb-3 font-medium">Pública (Promotor)</th>
                  <th className="text-center pb-3 font-medium">Comisión</th>
                  <th className="text-center pb-3 font-medium">Vendidas</th>
                  <th className="text-right pb-3 font-medium">Generado</th>
                  <th className="text-right pb-3 font-medium text-red-400">Su ganancia</th>
                  <th className="text-right pb-3 font-medium text-green-400">Debe rendir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sales.map(s => (
                  <tr key={s.promotor_id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="py-4 pr-2">
                      <p className="font-medium text-white">{s.name}</p>
                      <p className="text-xs text-brand font-mono mt-0.5">{s.promo_code}</p>
                    </td>
                    <td className="py-4 px-2 text-center text-gray-300">{s.commission}%</td>
                    <td className="py-4 px-2 text-center">{s.total_vendidas}</td>
                    <td className="py-4 pl-2 text-right">{fmt(s.total_recaudado)}</td>
                    <td className="py-4 pl-2 text-right text-red-400">{fmt(s.comision_promotor)}</td>
                    <td className="py-4 pl-2 text-right font-bold text-green-400">{fmt(s.debe_enviar)}</td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-500">No hay ventas registradas de promotores</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PromoterSales;
