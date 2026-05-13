import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';

const PromoterDashboard = () => {
  const { user }  = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promoInfo, setPromoInfo] = useState(null);

  useEffect(() => {
    // Obtenemos info del promotor desde la lista de usuarios
    api.get('/users').then(r => {
      const u = r.data.find(x => x.id === user?.id);
      if (u) setPromoInfo(u);
    }).catch(() => {});
  }, [user]);

  useEffect(() => {
    api.get('/tickets').then(r => {
      // Filtrar solo mis ventas (en una mejora real se haría server-side)
      setTickets(r.data.filter(t => t.promotor_id));
    }).finally(() => setLoading(false));
  }, []);

  const totalVentas = tickets.length;
  const totalRecaudado = tickets.reduce((acc, t) => acc + parseFloat(t.amount_paid || 0), 0);

  const myLink = promoInfo?.promo_code
    ? `${window.location.origin}/eventos?promo=${promoInfo.promo_code}`
    : null;

  const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-2">Mi Panel de Promotor</h1>
        <p className="text-gray-400 mb-6">Hola, {user?.name}! Acá podés ver tus ventas.</p>

        {/* Mi link */}
        {myLink && (
          <div className="card mb-6">
            <p className="text-sm text-gray-400 mb-2">Tu link de venta</p>
            <div className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-2">
              <span className="font-mono text-brand text-sm flex-1 truncate">{myLink}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(myLink); }}
                className="text-xs text-gray-400 hover:text-white shrink-0"
              >
                Copiar
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Código: <span className="font-mono text-brand">{promoInfo?.promo_code}</span>
              {promoInfo?.commission > 0 && ` · Comisión: ${promoInfo.commission}%`}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="card">
            <p className="text-sm text-gray-400">Entradas vendidas</p>
            <p className="text-3xl font-bold text-brand mt-1">{totalVentas}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-400">Total generado</p>
            <p className="text-3xl font-bold text-green-400 mt-1">{fmt(totalRecaudado)}</p>
          </div>
        </div>

        {/* Tabla de ventas */}
        <div className="card overflow-x-auto">
          <h2 className="font-semibold mb-4">Mis ventas</h2>
          {loading ? (
            <p className="text-gray-500">Cargando...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-800">
                  <th className="text-left pb-2">Comprador</th>
                  <th className="text-left pb-2">Evento</th>
                  <th className="text-left pb-2">Tipo</th>
                  <th className="text-right pb-2">Monto</th>
                  <th className="text-left pb-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {tickets.map(t => (
                  <tr key={t.id}>
                    <td className="py-2">{t.buyer_name}</td>
                    <td className="py-2 text-gray-400">{t.evento}</td>
                    <td className="py-2 text-gray-400">{t.tipo_entrada}</td>
                    <td className="py-2 text-right text-green-400">{fmt(t.amount_paid)}</td>
                    <td className="py-2">
                      <span className={`badge-${t.status}`}>{t.status}</span>
                    </td>
                  </tr>
                ))}
                {tickets.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-6 text-gray-500">Todavía no tenés ventas</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
};

export default PromoterDashboard;
