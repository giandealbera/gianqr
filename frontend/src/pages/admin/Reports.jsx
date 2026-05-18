import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import { exportCsv } from '../../utils/exportCsv';

const METHOD_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', mercadopago: 'MercadoPago', cortesia: 'Cortesía' };

const Reports = () => {
  const [events,  setEvents]  = useState([]);
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ event_id: '', from: '', to: '', method: '' });

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

  // Filtrado en cliente por método de pago (el filtro fecha/evento es server-side)
  const filteredDetalle = useMemo(() => {
    if (!report?.detalle) return [];
    if (!filters.method) return report.detalle;
    return report.detalle.filter(t => t.payment_method === filters.method);
  }, [report, filters.method]);

  // Si filtran por método, recalculamos totales en cliente
  const resumen = useMemo(() => {
    if (!report) return [];
    if (!filters.method) return report.resumen;
    const filtered = report.resumen.filter(r => r.payment_method === filters.method);
    return filtered;
  }, [report, filters.method]);

  const totalGeneral = useMemo(() => {
    if (!filters.method) return report?.total_general || 0;
    return filteredDetalle.reduce((acc, t) => acc + parseFloat(t.amount_paid || 0), 0);
  }, [report, filters.method, filteredDetalle]);

  const handleExportCsv = () => {
    if (!filteredDetalle.length) return;
    exportCsv({
      filename: 'reporte-ventas',
      rows: filteredDetalle,
      columns: [
        { key: 'buyer_name',     label: 'Comprador' },
        { key: 'buyer_email',    label: 'Email' },
        { key: 'evento',         label: 'Evento' },
        { key: 'tipo_entrada',   label: 'Tipo' },
        { key: 'payment_method', label: 'Método', format: (v) => METHOD_LABEL[v] || v },
        { key: 'amount_paid',    label: 'Monto', format: (v) => parseFloat(v || 0).toFixed(2) },
        { key: 'created_at',     label: 'Fecha', format: (v) => v ? new Date(v).toISOString().slice(0, 19).replace('T', ' ') : '' },
      ],
    });
  };

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Reportes de ventas</h1>

        {/* Filtros */}
        <div className="card mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Evento</label>
              <select className="input" value={filters.event_id}
                onChange={e => setFilters(f => ({ ...f, event_id: e.target.value }))}>
                <option value="">Todos los eventos</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Desde</label>
              <input type="date" className="input" value={filters.from}
                onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Hasta</label>
              <input type="date" className="input" value={filters.to}
                onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Método</label>
              <select className="input" value={filters.method}
                onChange={e => setFilters(f => ({ ...f, method: e.target.value }))}>
                <option value="">Todos</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="mercadopago">MercadoPago</option>
                <option value="cortesia">Cortesía</option>
              </select>
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
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
              {resumen.map(r => (
                <div key={r.payment_method} className="card">
                  <p className="text-sm text-gray-400">{METHOD_LABEL[r.payment_method] || r.payment_method}</p>
                  <p className="text-2xl font-bold text-white mt-1">{fmt(r.total)}</p>
                  <p className="text-xs text-gray-500 mt-1">{r.cantidad} entradas</p>
                </div>
              ))}
              <div className="card border-brand/40">
                <p className="text-sm text-gray-400">Total recaudado</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{fmt(totalGeneral)}</p>
                <p className="text-xs text-gray-500 mt-1">{filteredDetalle.length} entradas</p>
              </div>
            </div>

            {/* Acciones de export */}
            {filteredDetalle.length > 0 && (
              <div className="flex gap-2 mb-3 justify-end">
                <button onClick={handleExportCsv} className="btn-secondary text-xs">
                  📥 Exportar CSV (Excel)
                </button>
                <button onClick={() => window.print()} className="btn-secondary text-xs">
                  🖨️ Imprimir
                </button>
              </div>
            )}

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
                  {filteredDetalle.map(t => (
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
                  {filteredDetalle.length === 0 && (
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
