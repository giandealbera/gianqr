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
  const openEdit = (tt) => { setEditId(tt.id); setForm({ name: tt.name, price: tt.price, total_quota: '' }); setShowForm(true); };
  const cancel = () => { setShowForm(false); setEditId(null); setForm(emptyForm); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/events/${id}/ticket-types/${editId}`, { add_quota: parseInt(form.total_quota) });
        toast.success(`+${form.total_quota} entradas agregadas`);
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

        {/* Formulario nueva/editar tanda */}
        {showForm && (
          <form onSubmit={handleSubmit} className="card mb-6 space-y-4">
            <h2 className="font-semibold">{editId ? `Agregar entradas — ${form.name}` : 'Nueva tanda'}</h2>
            {!editId && (
              <>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Nombre *</label>
                  <input className="input" required placeholder="ej: Early Bird, General, VIP"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Precio *</label>
                  <input className="input" required type="number" min="0" placeholder="$"
                    value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
                </div>
              </>
            )}
            <div>
              <label className="text-sm text-gray-400 block mb-1">
                {editId ? 'Entradas a agregar *' : 'Cupo inicial *'}
              </label>
              <input className="input" required type="number" min="1"
                placeholder={editId ? 'ej: 50' : 'ej: 100'}
                value={form.total_quota} onChange={e => setForm(f => ({ ...f, total_quota: e.target.value }))} />
              {editId && <p className="text-xs text-gray-500 mt-1">Se suman al cupo actual de esta tanda</p>}
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Guardando...' : editId ? 'Agregar entradas' : 'Crear tanda'}
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
                      + Entradas
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
        {/* Links de escáner generados */}
        {tokens.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">🔗 Links de escáner activos</h2>
            <div className="space-y-2">
              {tokens.map(t => (
                <div key={t.id} className="card py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t.ticket_type_name}</p>
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
