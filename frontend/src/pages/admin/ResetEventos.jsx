import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Layout from '../../components/Layout';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);

const ResetEventos = () => {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null); // {event_id, name, vendidas, recaudado}
  const [typed, setTyped]     = useState('');
  const [resetting, setReset] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/events/history?include_inactive=1');
      setList(r.data);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const askConfirm = (ev) => {
    setConfirm(ev);
    setTyped('');
  };

  const cancel = () => { setConfirm(null); setTyped(''); };

  const doReset = async () => {
    if (typed !== 'REINICIAR') return;
    setReset(true);
    try {
      const r = await api.post(`/events/${confirm.event_id}/reset`);
      toast.success(
        `"${confirm.name}" reiniciado — ${r.data.borrados.tickets} tickets y ${r.data.borrados.rendiciones} rendiciones borrados`
      );
      cancel();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al reiniciar');
    } finally {
      setReset(false);
    }
  };

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Reiniciar eventos</h1>
        <p className="text-sm text-gray-400 mb-6">
          Borra los <span className="text-red-400 font-medium">tickets vendidos</span> y las{' '}
          <span className="text-red-400 font-medium">rendiciones</span> del evento.<br />
          Se conservan: el evento, los tipos de entrada (con sus precios/cupos), los usuarios y los proveedores.
        </p>

        {loading && <p className="text-gray-500">Cargando...</p>}

        {!loading && list.length === 0 && (
          <div className="card text-center text-gray-500 py-10">No hay eventos cargados.</div>
        )}

        {!loading && list.length > 0 && (
          <div className="space-y-2">
            {list.map(ev => {
              const hasData = parseInt(ev.vendidas || 0) + parseInt(ev.usadas || 0)
                + parseInt(ev.cortesias || 0) + parseInt(ev.pendientes || 0) > 0
                || parseFloat(ev.ya_rindio || 0) > 0;
              return (
                <div key={ev.event_id} className="card flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">
                      {ev.name}
                      {!ev.is_active && <span className="ml-2 text-xs text-gray-500">(inactivo)</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(ev.date).toLocaleDateString('es-AR')}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-2">
                      <span className="text-gray-400">Vendidas: <span className="text-white font-medium">{ev.vendidas}</span></span>
                      {parseInt(ev.cortesias) > 0 && <span className="text-gray-400">Cortesías: <span className="text-white font-medium">{ev.cortesias}</span></span>}
                      <span className="text-gray-400">Recaudado: <span className="text-green-400 font-medium">{fmt(ev.recaudado_total)}</span></span>
                      <span className="text-gray-400">Rendido: <span className="text-emerald-400 font-medium">{fmt(ev.ya_rindio)}</span></span>
                    </div>
                  </div>
                  <button
                    onClick={() => askConfirm(ev)}
                    disabled={!hasData}
                    className="shrink-0 px-3 py-2 rounded-lg text-sm font-medium border border-red-900/50 text-red-400 hover:bg-red-900/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title={hasData ? 'Borrar tickets y rendiciones de este evento' : 'No hay nada que reiniciar'}
                  >
                    Reiniciar
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de confirmación */}
        {confirm && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={cancel}
          >
            <div
              className="card max-w-md w-full"
              style={{ borderColor: '#7F1D1D' }}
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-red-400 mb-2">⚠ Confirmar reinicio</h2>
              <p className="text-sm text-gray-300 mb-3">
                Vas a borrar permanentemente los datos de ventas de <strong>{confirm.name}</strong>:
              </p>
              <ul className="text-sm text-gray-400 space-y-1 mb-4 ml-4 list-disc">
                <li><span className="text-white font-medium">{confirm.vendidas}</span> entradas vendidas</li>
                {parseInt(confirm.cortesias) > 0 && (
                  <li><span className="text-white font-medium">{confirm.cortesias}</span> cortesías</li>
                )}
                <li>{fmt(confirm.recaudado_total)} recaudados</li>
                <li>{fmt(confirm.ya_rindio)} rendidos</li>
              </ul>
              <p className="text-xs text-gray-500 mb-3">
                Los tipos de entrada y sus precios/cupos se conservan. Esta acción no se puede deshacer.
              </p>
              <label className="text-xs text-gray-400 block mb-1">
                Escribí <strong className="text-red-400">REINICIAR</strong> para confirmar:
              </label>
              <input
                type="text"
                className="input mb-4"
                value={typed}
                onChange={e => setTyped(e.target.value)}
                autoFocus
              />
              <div className="flex gap-3 justify-end">
                <button onClick={cancel} className="btn-secondary" disabled={resetting}>Cancelar</button>
                <button
                  onClick={doReset}
                  disabled={typed !== 'REINICIAR' || resetting}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-900/40 text-red-300 border border-red-900/60 hover:bg-red-900/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {resetting ? 'Reiniciando...' : 'Confirmar reinicio'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ResetEventos;
