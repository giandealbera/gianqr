import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const PromoterDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMoney, setShowMoney] = useState(false);

  useEffect(() => {
    api.get('/users/my-sales')
      .then(res => setData(res.data))
      .catch(() => toast.error('Error al cargar panel de promotor'))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);

  const myLink = data?.promo_code
    ? `${window.location.origin}/eventos?promo=${data.promo_code}`
    : null;

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">Mi Panel de Promotor</h1>
          {data && (
            <button
              onClick={() => setShowMoney(!showMoney)}
              className="text-gray-500 hover:text-gray-300 transition-colors bg-gray-800/50 p-2 rounded-lg"
              title={showMoney ? 'Ocultar importes' : 'Mostrar importes'}
            >
              {showMoney ? '👁️' : '🔒'}
            </button>
          )}
        </div>
        <p className="text-gray-400 mb-6">Hola, {user?.name}! Acá podés ver tus ventas y comisiones.</p>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand" />
          </div>
        ) : !data ? (
          <p className="text-center text-gray-500 py-12">No hay datos disponibles</p>
        ) : (
          <>
            {/* Link & Code */}
            <div className="card mb-6">
              <p className="text-sm text-gray-400 mb-2">Tu link de venta</p>
              <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-2">
                <span className="font-mono text-brand text-sm flex-1 truncate">{myLink}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(myLink);
                    toast.success('Link copiado!');
                  }}
                  className="text-xs text-brand hover:text-white shrink-0 bg-brand/20 px-3 py-1.5 rounded"
                >
                  Copiar
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-3 flex items-center gap-2">
                <span>Código: <strong className="text-white">{data.promo_code}</strong></span>
                <span>·</span>
                <span>Comisión: <strong className="text-green-400">{data.commission}%</strong></span>
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="card text-center py-4">
                <p className="text-3xl font-black text-brand">{data.summary?.total_vendidas || 0}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Vendidas</p>
              </div>
              <div className="card text-center py-4">
                <p className="text-3xl font-black text-gray-200">{showMoney ? fmt(data.summary?.total_recaudado) : '$ •••••'}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Recaudado</p>
              </div>
              <div className="card text-center py-4 border-green-500/30 bg-green-900/10">
                <p className="text-3xl font-black text-green-400">{showMoney ? fmt(data.summary?.mi_comision) : '$ •••••'}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Mi Ganancia</p>
              </div>
              <div className="card text-center py-4 border-red-500/30 bg-red-900/10">
                <p className="text-3xl font-black text-red-400">{showMoney ? fmt(data.summary?.debo_enviar) : '$ •••••'}</p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">A rendir a la org.</p>
              </div>
            </div>

            {/* Breakdown by event */}
            {data.by_event?.length > 0 && (
              <div className="card mb-6">
                <h3 className="font-semibold text-sm mb-4">Desglose por Evento</h3>
                <div className="space-y-3">
                  {data.by_event.map((ev, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <div className="mb-2 sm:mb-0">
                        <p className="font-medium text-white">{ev.evento}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR')} · {ev.vendidas} entradas
                        </p>
                      </div>
                      <div className="flex gap-4 text-right">
                        <div>
                          <p className="text-xs text-gray-500 uppercase">Recaudado</p>
                          <p className="text-sm font-semibold">{showMoney ? fmt(ev.recaudado) : '***'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase">A enviar</p>
                          <p className="text-sm font-bold text-red-400">{showMoney ? fmt(ev.a_enviar) : '***'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent sales */}
            <div className="card overflow-x-auto">
              <h2 className="font-semibold mb-4">Últimas Ventas</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800">
                    <th className="text-left pb-2 font-medium">Comprador</th>
                    <th className="text-left pb-2 font-medium">Evento</th>
                    <th className="text-left pb-2 font-medium">Tipo</th>
                    <th className="text-right pb-2 font-medium">Monto</th>
                    <th className="text-left pb-2 font-medium pl-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {data.recent?.map((t, i) => (
                    <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                      <td className="py-3 pr-2">{t.buyer_name}</td>
                      <td className="py-3 pr-2 text-gray-400">{t.evento}</td>
                      <td className="py-3 pr-2 text-gray-400">{t.tipo_entrada}</td>
                      <td className="py-3 pr-2 text-right text-green-400">{showMoney ? fmt(t.amount_paid) : '***'}</td>
                      <td className="py-3 pl-3">
                        <span className={`badge-${t.status}`}>{t.status}</span>
                      </td>
                    </tr>
                  ))}
                  {(!data.recent || data.recent.length === 0) && (
                    <tr><td colSpan={5} className="text-center py-6 text-gray-500">Todavía no tenés ventas</td></tr>
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

export default PromoterDashboard;
