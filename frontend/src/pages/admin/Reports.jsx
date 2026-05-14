import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';

const METHOD_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia' };

const Reports = () => {
  const [events,  setEvents]  = useState([]);
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ event_id: '', from: '', to: '' });

  useEffect(() => { api.get('/events').then(r => setEvents(r.data)); }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.event_id) params.set('event_id', filters.event_id);
      if (filters.from)     params.set('from', filters.from);
      if (filters.to)       params.set('to', filters.to);
      const r = await api.get(`/payments/report?${params}`);
      setReport(r.data);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, []);

  const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Reportes de ventas</h1>

        {/* Filtros */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Evento</label>
              <select className="input" value={filters.event_id}
                onChange={e => setFilters(f => ({ ...f, event_id: e.target.value }))}>
                <option value="">Todos los eventos</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Desde</label>
              <input type="date" className="input" value={filters.from}
                onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Hasta</label>
              <input type="date" className="input" value={filters.to}
                onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
            </div>
            <div className="flex items-end">
              <button onClick={fetchReport} className="btn-primary w-full">Buscar</button>
            </div>
          </div>
        </div>

        {loading && <p className="text-gray-500">Cargando...</p>}

        {report && (
          <>
            {/* Resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {report.resumen.map(r => (
                <div key={r.payment_method} className="card">
                  <p className="text-sm text-gray-400">{METHOD_LABEL[r.payment_method] || r.payment_method}</p>
                  <p className="text-2xl font-bold text-white mt-1">{fmt(r.total)}</p>
                  <p className="text-xs text-gray-500 mt-1">{r.cantidad} entradas</p>
                </div>
              ))}
              <div className="card border-brand/40">
                <p className="text-sm text-gray-400">Total recaudado</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{fmt(report.total_general)}</p>
              </div>
            </div>

            {/* Detalle */}
            <div className="card overflow-x-auto">
              <h2 className="font-semibold mb-4">Detalle de ventas</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800">
                    <th className="text-left pb-2">Comprador</th>
                    <th className="text-left pb-2">Evento</th>
                    <th className="text-left pb-2">Tipo</th>
                    <th className="text-left pb-2">Método</th>
                    <th className="text-right pb-2">Monto</th>
                    <th className="text-left pb-2">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {report.detalle.map(t => (
                    <tr key={t.id} className="hover:bg-gray-800/40">
                      <td className="py-2">
                        <div className="font-medium">{t.buyer_name}</div>
                        <div className="text-gray-500 text-xs">{t.buyer_email}</div>
                      </td>
                      <td className="py-2 text-gray-400">{t.evento}</td>
                      <td className="py-2 text-gray-400">{t.tipo_entrada}</td>
                      <td className="py-2">{METHOD_LABEL[t.payment_method] || t.payment_method}</td>
                      <td className="py-2 text-right text-green-400 font-medium">{fmt(t.amount_paid)}</td>
                      <td className="py-2 text-gray-400 text-xs">
                        {new Date(t.created_at).toLocaleDateString('es-AR')}
                      </td>
                    </tr>
                  ))}
                  {report.detalle.length === 0 && (
                    <tr><td colSpan={6} className="py-6 text-center text-gray-500">Sin resultados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Reports;
