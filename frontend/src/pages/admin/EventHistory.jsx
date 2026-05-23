import { Fragment, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);
const num = (n) => parseFloat(n || 0);

const EventHistory = () => {
  const [events, setEvents] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ event_id: '', from: '', to: '' });
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => { api.get('/events').then(r => setEvents(r.data)); }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.event_id) params.set('event_id', filters.event_id);
      if (filters.from)     params.set('from', filters.from);
      if (filters.to)       params.set('to', filters.to);
      const r = await api.get(`/events/history?${params}`);
      setRows(r.data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    vendidas:            acc.vendidas            + parseInt(r.vendidas || 0),
    recaudado_total:     acc.recaudado_total     + num(r.recaudado_total),
    ya_rindio:           acc.ya_rindio           + num(r.ya_rindio),
    pendiente_rendicion: acc.pendiente_rendicion + num(r.pendiente_rendicion),
  }), { vendidas: 0, recaudado_total: 0, ya_rindio: 0, pendiente_rendicion: 0 }), [rows]);

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Historial de eventos</h1>

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
              <label className="text-sm text-gray-400 block mb-1">Desde (fecha del evento)</label>
              <input type="date" className="input" value={filters.from}
                onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Hasta (fecha del evento)</label>
              <input type="date" className="input" value={filters.to}
                onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
            </div>
            <div className="flex items-end">
              <button onClick={fetchHistory} className="btn-primary w-full">Buscar</button>
            </div>
          </div>
        </div>

        {loading && <p className="text-gray-500">Cargando...</p>}

        {!loading && (
          <>
            {/* Totales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="card">
                <p className="text-sm text-gray-400">Entradas vendidas</p>
                <p className="text-2xl font-bold text-white mt-1">{totals.vendidas}</p>
                <p className="text-xs text-gray-500 mt-1">{rows.length} evento{rows.length === 1 ? '' : 's'}</p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-400">Recaudado total</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{fmt(totals.recaudado_total)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-400">Ya rindieron</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{fmt(totals.ya_rindio)}</p>
              </div>
              <div className="card">
                <p className="text-sm text-gray-400">Pendiente de rendir</p>
                <p className={`text-2xl font-bold mt-1 ${totals.pendiente_rendicion > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {fmt(totals.pendiente_rendicion)}
                </p>
              </div>
            </div>

            {/* Tabla por evento */}
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800">
                    <th className="text-left pb-2 pr-3">Evento</th>
                    <th className="text-center pb-2 px-2">Vendidas</th>
                    <th className="text-center pb-2 px-2">Usadas</th>
                    <th className="text-center pb-2 px-2">Cortesías</th>
                    <th className="text-center pb-2 px-2">Pend. / Canc.</th>
                    <th className="text-right pb-2 px-2">Recaudado</th>
                    <th className="text-right pb-2 px-2">Rendido</th>
                    <th className="text-right pb-2 pl-2">Pendiente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {rows.map(r => {
                    const expanded = expandedId === r.event_id;
                    const pend = num(r.pendiente_rendicion);
                    return (
                      <Fragment key={r.event_id}>
                        <tr
                          className="hover:bg-gray-800/40 cursor-pointer"
                          onClick={() => setExpandedId(expanded ? null : r.event_id)}
                        >
                          <td className="py-3 pr-3">
                            <div className="font-medium">{r.name}</div>
                            <div className="text-gray-500 text-xs">
                              {new Date(r.date).toLocaleDateString('es-AR')}
                              {!r.is_active && <span className="ml-2 text-gray-600">(inactivo)</span>}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-center font-semibold text-white">{r.vendidas}</td>
                          <td className="py-3 px-2 text-center text-emerald-400">{r.usadas}</td>
                          <td className="py-3 px-2 text-center">
                            {parseInt(r.cortesias) > 0
                              ? <span className="text-gray-300">{r.cortesias}</span>
                              : <span className="text-gray-600">—</span>}
                          </td>
                          <td className="py-3 px-2 text-center text-xs">
                            {parseInt(r.pendientes) > 0 && <span className="text-amber-400">{r.pendientes} pend</span>}
                            {parseInt(r.pendientes) > 0 && parseInt(r.canceladas) > 0 && <span className="text-gray-600"> · </span>}
                            {parseInt(r.canceladas) > 0 && <span className="text-red-400">{r.canceladas} canc</span>}
                            {parseInt(r.pendientes) === 0 && parseInt(r.canceladas) === 0 && <span className="text-gray-600">—</span>}
                          </td>
                          <td className="py-3 px-2 text-right font-medium text-green-400">{fmt(r.recaudado_total)}</td>
                          <td className="py-3 px-2 text-right text-emerald-400">{fmt(r.ya_rindio)}</td>
                          <td className={`py-3 pl-2 text-right font-semibold ${pend > 0.01 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {pend > 0.01 ? fmt(pend) : 'OK'}
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="bg-gray-900/30">
                            <td colSpan={8} className="py-3 px-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div>
                                  <p className="text-gray-500">Efectivo</p>
                                  <p className="text-green-400 font-medium">{fmt(r.recaudado_efectivo)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Transferencia</p>
                                  <p className="text-green-400 font-medium">{fmt(r.recaudado_transferencia)}</p>
                                </div>
                                <div>
                                  <p className="text-gray-500">Comisiones públicas</p>
                                  <p className="text-amber-400 font-medium">{fmt(r.comisiones_total)}</p>
                                </div>
                                <div className="md:col-span-2">
                                  <p className="text-gray-500">Recaudado neto (recaudado - comisiones)</p>
                                  <p className="text-white font-semibold">{fmt(r.recaudado_neto)}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={8} className="py-6 text-center text-gray-500">Sin resultados</td></tr>
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

export default EventHistory;
