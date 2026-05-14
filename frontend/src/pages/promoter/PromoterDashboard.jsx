import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const emptyMember = { name: '', apellido: '', celular: '', localidad: '', email: '', password: '', commission: 800 };
const FRONTEND = window.location.origin;

const PromoterDashboard = () => {
  const { user } = useAuth();
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [showMoney,  setShowMoney]  = useState(false);
  const [team,         setTeam]         = useState([]);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [memberForm,   setMemberForm]   = useState(emptyMember);
  const [saving,       setSaving]       = useState(false);
  const [newMagicLink, setNewMagicLink] = useState(null); // link del último vendedor creado

  const loadTeam = () => {
    if (user?.role === 'jefe_publicas') {
      api.get('/users/my-team').then(r => setTeam(r.data)).catch(() => {});
    }
  };

  useEffect(() => {
    api.get('/users/my-sales')
      .then(res => setData(res.data))
      .catch(() => toast.error('Error al cargar panel de promotor'))
      .finally(() => setLoading(false));
    loadTeam();
  }, []);

  const handleAddMember = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/users/team', memberForm);
      toast.success('Vendedor agregado!');
      setShowTeamForm(false);
      setMemberForm(emptyMember);
      if (res.data.magic_token) {
        setNewMagicLink(`${FRONTEND}/acceso/${res.data.magic_token}`);
      }
      loadTeam();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear vendedor');
    } finally {
      setSaving(false);
    }
  };

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
                <span>Comisión Propia: <strong className="text-green-400">${data.commission} x entrada</strong></span>
              </p>
            </div>

            {/* Team Summary + Members (If Jefe) */}
            {data.summary?.es_jefe && (
              <div className="mb-6">
                <h3 className="font-semibold text-sm mb-3">Resumen de Mi Equipo</h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="card text-center py-4 border-brand/30 bg-brand/10">
                    <p className="text-3xl font-black text-white">{data.summary.equipo_vendidas}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Vendidas por mi equipo</p>
                  </div>
                  <div className="card text-center py-4 border-green-500/30 bg-green-900/10">
                    <p className="text-3xl font-black text-green-400">{showMoney ? fmt(data.summary.mi_comision_jefe) : '$ •••••'}</p>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">Mi Ganancia de Equipo</p>
                  </div>
                </div>

                {/* Lista de vendedores */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-sm">Mis Vendedores ({team.length})</h4>
                    <button onClick={() => setShowTeamForm(!showTeamForm)} className="btn-primary text-xs py-1.5 px-3">
                      {showTeamForm ? 'Cancelar' : '+ Agregar vendedor'}
                    </button>
                  </div>

                  {/* Link del último vendedor creado */}
                  {newMagicLink && (
                    <div className="mb-4 p-3 bg-brand/10 border border-brand/30 rounded-xl">
                      <p className="text-xs font-semibold text-brand mb-2">🔗 Link de acceso del vendedor — mandáselo por WhatsApp</p>
                      <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-2">
                        <span className="font-mono text-xs text-gray-300 flex-1 truncate">{newMagicLink}</span>
                        <button onClick={() => { navigator.clipboard.writeText(newMagicLink); toast.success('Link copiado!'); }}
                          className="text-xs text-brand shrink-0 bg-brand/20 px-2 py-1 rounded">
                          Copiar
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1.5">Con este link el vendedor entra directo a su panel sin contraseña. Puede guardarlo en favoritos.</p>
                      <button onClick={() => setNewMagicLink(null)} className="text-[10px] text-gray-600 mt-1 underline">Cerrar</button>
                    </div>
                  )}

                  {showTeamForm && (
                    <form onSubmit={handleAddMember} className="mb-4 p-4 bg-gray-800/50 rounded-xl space-y-3">
                      <h5 className="text-sm font-medium text-gray-300">Nuevo vendedor</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Nombre *</label>
                          <input className="input" required value={memberForm.name}
                            onChange={e => setMemberForm(f => ({ ...f, name: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Apellido</label>
                          <input className="input" value={memberForm.apellido}
                            onChange={e => setMemberForm(f => ({ ...f, apellido: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Celular</label>
                          <input className="input" placeholder="ej: 2645 123456" value={memberForm.celular}
                            onChange={e => setMemberForm(f => ({ ...f, celular: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Localidad</label>
                          <input className="input" placeholder="ej: San Juan" value={memberForm.localidad}
                            onChange={e => setMemberForm(f => ({ ...f, localidad: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Email *</label>
                          <input type="email" className="input" required value={memberForm.email}
                            onChange={e => setMemberForm(f => ({ ...f, email: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Contraseña *</label>
                          <input type="password" className="input" required value={memberForm.password}
                            onChange={e => setMemberForm(f => ({ ...f, password: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs text-gray-400 block mb-1">Comisión del vendedor ($ por entrada)</label>
                          <input type="number" className="input" min="0" value={memberForm.commission}
                            onChange={e => setMemberForm(f => ({ ...f, commission: e.target.value }))} />
                        </div>
                      </div>
                      <button type="submit" disabled={saving} className="btn-primary w-full">
                        {saving ? 'Guardando...' : 'Crear vendedor'}
                      </button>
                    </form>
                  )}

                  {team.length === 0 ? (
                    <p className="text-center text-gray-500 text-sm py-4">Todavía no tenés vendedores en tu equipo</p>
                  ) : (
                    <div className="divide-y divide-gray-800">
                      {team.map(m => (
                        <div key={m.id} className="py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{m.name} {m.apellido || ''}</p>
                              <p className="text-xs text-gray-500">{m.celular || m.email}</p>
                              {m.localidad && <p className="text-xs text-gray-600">{m.localidad}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-brand">{m.total_vendidas ?? 0} <span className="text-xs text-gray-400 font-normal">entradas</span></p>
                              <p className="text-xs text-gray-500">{showMoney ? fmt(m.total_recaudado) : '$ •••'}</p>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${m.is_active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}>
                                {m.is_active ? 'Activo' : 'Inactivo'}
                              </span>
                            </div>
                          </div>
                          {m.magic_token && (
                            <button
                              onClick={() => { navigator.clipboard.writeText(`${FRONTEND}/acceso/${m.magic_token}`); toast.success('Link copiado!'); }}
                              className="mt-1.5 text-[10px] text-brand/70 hover:text-brand flex items-center gap-1 transition-colors">
                              🔗 Copiar link de acceso
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Summary Cards */}
            <h3 className="font-semibold text-sm mb-3">Mis Ventas Propias</h3>
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
              <h2 className="font-semibold mb-4">Últimas Ventas Propias</h2>
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
