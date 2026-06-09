import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';

const emptyForm = { name: '', price: '', total_quota: '' };
const FRONTEND = window.location.origin;

const EventTicketTypes = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event,    setEvent]    = useState(null);
  const [types,    setTypes]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState(null);
  const [form,     setForm]     = useState(emptyForm);
  const [saving,   setSaving]   = useState(false);
  const [tokens,   setTokens]   = useState([]);
  const [genningFor, setGenningFor] = useState(null); // ticket_type_id generando link
  const [origType, setOrigType] = useState(null); // snapshot del tipo al abrir edit para detectar cambios

  // Modal "Quien vende": permisos por tipo de entrada.
  // sellersFor: ticket_type seleccionado. allSellers: lista completa de
  // jefes/vendedores del owner (para los checkboxes). selectedSellers:
  // Set de user_ids marcados.
  const [sellersFor,       setSellersFor]       = useState(null);
  const [allSellers,       setAllSellers]       = useState([]);
  const [selectedSellers,  setSelectedSellers]  = useState(new Set());
  const [sellersLoading,   setSellersLoading]   = useState(false);
  const [sellersSaving,    setSellersSaving]    = useState(false);

  const openSellers = async (tt) => {
    setSellersFor(tt);
    setSellersLoading(true);
    try {
      const [usersRes, currentRes] = await Promise.all([
        api.get('/users'),
        api.get(`/events/${id}/ticket-types/${tt.id}/sellers`),
      ]);
      // Solo jefes y vendedores activos. El admin/owner siempre puede vender,
      // no van en la lista.
      const eligible = usersRes.data.filter(u =>
        ['jefe_publicas', 'vendedor'].includes(u.role) && u.is_active
      );
      setAllSellers(eligible);
      setSelectedSellers(new Set(currentRes.data.map(s => s.user_id)));
    } catch (err) {
      toast.error('No se pudo cargar la lista de vendedores');
      setSellersFor(null);
    } finally {
      setSellersLoading(false);
    }
  };

  const closeSellers = () => {
    setSellersFor(null);
    setSelectedSellers(new Set());
    setAllSellers([]);
  };

  const toggleSeller = (userId) => {
    setSelectedSellers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const saveSellers = async () => {
    if (!sellersFor) return;
    setSellersSaving(true);
    try {
      const user_ids = Array.from(selectedSellers);
      await api.put(`/events/${id}/ticket-types/${sellersFor.id}/sellers`, { user_ids });
      toast.success(
        user_ids.length === 0
          ? `${sellersFor.name}: abierto a todos`
          : `${sellersFor.name}: ${user_ids.length} habilitado${user_ids.length === 1 ? '' : 's'}`
      );
      closeSellers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar permisos');
    } finally {
      setSellersSaving(false);
    }
  };

  const load = async () => {
    try {
      const [evRes, ttRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/events/${id}/ticket-types`),
      ]);
      setEvent(evRes.data);
      setTypes(ttRes.data);
    } catch {
      toast.error('No se pudo cargar el evento');
      navigate('/eventos');
    } finally {
      setLoading(false);
    }
  };

  const loadTokens = async () => {
    try {
      const res = await api.get(`/scanner-tokens?event_id=${id}`);
      setTokens(res.data);
    } catch { /* no crítico */ }
  };

  useEffect(() => { load(); loadTokens(); }, [id]);

  const generateLink = async (tt) => {
    setGenningFor(tt.id);
    try {
      const res = await api.post('/scanner-tokens', {
        event_id: id,
        ticket_type_id: tt.id,
        label: tt.name,
      });
      setTokens(prev => [res.data, ...prev]);
      toast.success('Link generado!');
    } catch {
      toast.error('Error al generar link');
    } finally {
      setGenningFor(null);
    }
  };

  // Link que valida TODOS los tipos del evento (un solo portero para todo).
  const generateAllTypesLink = async () => {
    setGenningFor('all');
    try {
      const res = await api.post('/scanner-tokens', {
        event_id: id,
        all_types: true,
        label: 'Todos los tipos',
      });
      setTokens(prev => [res.data, ...prev]);
      toast.success('Link para todos los tipos generado!');
    } catch {
      toast.error('Error al generar link');
    } finally {
      setGenningFor(null);
    }
  };

  const revokeToken = async (tokenId) => {
    try {
      await api.delete(`/scanner-tokens/${tokenId}`);
      setTokens(prev => prev.filter(t => t.id !== tokenId));
      toast.success('Link revocado');
    } catch {
      toast.error('Error al revocar');
    }
  };

  const copyLink = (token) => {
    navigator.clipboard.writeText(`${FRONTEND}/scan/${token}`);
    toast.success('Link copiado!');
  };

  const openNew = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };
  // En edit, precargo name y price (editables) y dejo total_quota vacio (es "cuanto agregar")
  const openEdit = (tt) => { setEditId(tt.id); setOrigType(tt); setForm({ name: tt.name, price: String(tt.price), total_quota: '' }); setShowForm(true); };
  const cancel = () => { setShowForm(false); setEditId(null); setOrigType(null); setForm(emptyForm); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        // Solo mandamos los campos que cambiaron
        const body = {};
        if (form.name && form.name.trim() !== origType?.name) body.name = form.name.trim();
        if (form.price && parseFloat(form.price) !== parseFloat(origType?.price)) body.price = parseFloat(form.price);
        if (form.total_quota && parseInt(form.total_quota) > 0) body.add_quota = parseInt(form.total_quota);
        if (Object.keys(body).length === 0) {
          toast.error('No cambiaste nada');
          setSaving(false);
          return;
        }
        await api.put(`/events/${id}/ticket-types/${editId}`, body);
        const msgs = [];
        if (body.name) msgs.push(`nombre`);
        if (body.price !== undefined) msgs.push(`precio`);
        if (body.add_quota) msgs.push(`+${body.add_quota} entradas`);
        toast.success(`Actualizado: ${msgs.join(', ')}`);
      } else {
        await api.post(`/events/${id}/ticket-types`, { name: form.name, price: parseFloat(form.price), total_quota: parseInt(form.total_quota) });
        toast.success('Tanda agregada');
      }
      cancel();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (tt) => {
    try {
      const res = await api.patch(`/events/${id}/ticket-types/${tt.id}/toggle`);
      setTypes(prev => prev.map(t => t.id === tt.id ? res.data : t));
      toast.success(res.data.is_active ? 'Tanda habilitada' : 'Tanda deshabilitada');
    } catch {
      toast.error('Error al cambiar estado');
    }
  };

  const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);

  if (loading) return (
    <Layout>
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <button onClick={() => navigate(`/evento/${id}`)} className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1 transition-colors">
          ← {event?.name}
        </button>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">🏷️ Tandas de entradas</h1>
            <p className="text-sm text-gray-400 mt-0.5">Configurá los precios y cupos</p>
          </div>
          <button onClick={openNew} className="btn-primary shrink-0">+ Nueva tanda</button>
        </div>

        {/* Link de portero para TODOS los tipos del evento */}
        {types.length > 0 && (
          <button
            onClick={generateAllTypesLink}
            disabled={genningFor === 'all'}
            className="w-full mb-5 text-sm px-3 py-2.5 rounded-lg border border-blue-800 text-blue-400 hover:border-blue-600 transition-colors disabled:opacity-50"
            title="Genera un link de portero que valida cualquier tipo de entrada del evento">
            {genningFor === 'all' ? 'Generando...' : '🔗 Link de portero para TODOS los tipos'}
          </button>
        )}

        {/* Formulario nueva/editar tanda */}
        {showForm && (
          <form onSubmit={handleSubmit} className="card mb-6 space-y-4">
            <h2 className="font-semibold">{editId ? `Editar tanda — ${origType?.name}` : 'Nueva tanda'}</h2>
            {editId && (
              <p className="text-xs text-amber-400 -mt-2">Si ya hay entradas vendidas, el cambio de precio solo afecta a las nuevas.</p>
            )}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Nombre {!editId && '*'}</label>
              <input className="input" required={!editId} placeholder="ej: Early Bird, General, VIP"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Precio {!editId && '*'}</label>
              <input className="input" required={!editId} type="number" min="0" step="0.01" placeholder="$"
                value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">
                {editId ? 'Entradas a agregar' : 'Cupo inicial *'}
              </label>
              <input className="input" required={!editId} type="number" min={editId ? "0" : "1"}
                placeholder={editId ? 'opcional — ej: 50' : 'ej: 100'}
                value={form.total_quota} onChange={e => setForm(f => ({ ...f, total_quota: e.target.value }))} />
              {editId && <p className="text-xs text-gray-500 mt-1">Si lo dejás vacío, no agrega entradas al cupo actual ({origType?.total_quota}).</p>}
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear tanda'}
              </button>
              <button type="button" onClick={cancel} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        )}

        {/* Lista de tandas */}
        <div className="space-y-3">
          {types.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🎟️</p>
              <p className="text-gray-400">No hay tandas todavía</p>
              <button onClick={openNew} className="btn-primary mt-4">+ Crear primera tanda</button>
            </div>
          ) : types.map(tt => {
            const pct = tt.total_quota > 0 ? Math.round((tt.sold_count / tt.total_quota) * 100) : 0;
            return (
              <div key={tt.id} className={`card transition-opacity ${!tt.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white">{tt.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tt.is_active ? 'bg-emerald-900/60 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}>
                        {tt.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-brand mt-1">{fmt(tt.price)}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {tt.sold_count} vendidas de {tt.total_quota} — {tt.available} disponibles
                    </p>
                    <div className="w-full bg-gray-800 rounded-full h-1.5 mt-2">
                      <div
                        className={`h-1.5 rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-brand'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => openEdit(tt)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors">
                      ✏️ Editar
                    </button>
                    <button onClick={() => openSellers(tt)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-amber-800 text-amber-400 hover:border-amber-600 transition-colors"
                      title="Elegir quién puede generar este tipo de entrada">
                      👥 Quién vende
                    </button>
                    <button onClick={() => generateLink(tt)} disabled={genningFor === tt.id}
                      className="text-xs px-3 py-1.5 rounded-lg border border-blue-800 text-blue-400 hover:border-blue-600 transition-colors disabled:opacity-50">
                      {genningFor === tt.id ? '...' : '🔗 Link'}
                    </button>
                    <button onClick={() => toggle(tt)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        tt.is_active
                          ? 'border-red-800 text-red-400 hover:border-red-600'
                          : 'border-emerald-800 text-emerald-400 hover:border-emerald-600'
                      }`}>
                      {tt.is_active ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Modal: quien puede vender este tipo de entrada */}
        {sellersFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
               style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
               onClick={(e) => { if (e.target === e.currentTarget) closeSellers(); }}>
            <div className="card w-full max-w-md max-h-[85vh] flex flex-col"
                 style={{ background: '#0D1117', border: '1px solid #1E2530' }}>
              <div className="flex items-start justify-between gap-3 mb-2 shrink-0">
                <div className="min-w-0">
                  <h2 className="font-semibold text-lg">Quién puede vender</h2>
                  <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                    Tanda: <span className="text-brand font-medium">{sellersFor.name}</span>
                  </p>
                </div>
                <button onClick={closeSellers} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
              </div>

              <p className="text-xs mb-3 shrink-0" style={{ color: '#9CA3AF' }}>
                Marcá quiénes pueden generar este tipo. <b>Si no marcás a nadie</b>, queda abierto a todos los jefes y vendedores.
              </p>

              {sellersLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-brand" />
                </div>
              ) : allSellers.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: '#6B7280' }}>
                  Todavía no tenés jefes ni vendedores creados. Agregalos en <span className="text-brand">Mi Personal</span>.
                </p>
              ) : (
                <div className="overflow-y-auto flex-1 min-h-0 -mx-1 px-1">
                  <div className="space-y-1.5">
                    {allSellers.map(u => {
                      const checked = selectedSellers.has(u.id);
                      return (
                        <label key={u.id}
                               className="flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors"
                               style={{ background: checked ? 'rgba(201,151,77,0.08)' : '#161B24',
                                        border: `1px solid ${checked ? 'rgba(201,151,77,0.4)' : '#1E2530'}` }}>
                          <input type="checkbox" className="w-4 h-4 accent-amber-600"
                                 checked={checked}
                                 onChange={() => toggleSeller(u.id)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: checked ? '#C9974D' : '#E8EAF0' }}>
                              {u.name} {u.apellido || ''}
                            </p>
                            <p className="text-[11px]" style={{ color: '#6B7280' }}>
                              {u.role === 'jefe_publicas' ? 'Jefe de Públicas' : 'Vendedor'} · {u.email}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-800 shrink-0">
                <p className="text-xs" style={{ color: '#6B7280' }}>
                  {selectedSellers.size === 0
                    ? 'Sin restricción (todos)'
                    : `${selectedSellers.size} seleccionado${selectedSellers.size === 1 ? '' : 's'}`}
                </p>
                <div className="flex gap-2">
                  <button onClick={closeSellers} className="btn-secondary text-sm py-1.5 px-3">Cancelar</button>
                  <button onClick={saveSellers} disabled={sellersSaving}
                          className="btn-primary text-sm py-1.5 px-4 disabled:opacity-40">
                    {sellersSaving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Links de escáner generados */}
        {tokens.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">🔗 Links de escáner activos</h2>
            <div className="space-y-2">
              {tokens.map(t => (
                <div key={t.id} className="card py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t.type_names || t.ticket_type_name}</p>
                    <p className="text-xs text-gray-500 font-mono truncate">{FRONTEND}/scan/{t.token}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => copyLink(t.token)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-brand/20 text-brand hover:bg-brand/30 transition-colors">
                      Copiar
                    </button>
                    <button onClick={() => revokeToken(t.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-800 text-red-400 hover:border-red-600 transition-colors">
                      Revocar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default EventTicketTypes;
