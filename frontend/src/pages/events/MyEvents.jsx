import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const initialForm = {
  name: '', description: '', date: '', start_time: '', end_time: '',
  sale_start_at: '', sale_end_at: '',
  venue_id: '', flyer_url: '',
  ticket_types: [{ name: 'General', price: '', total_quota: '' }],
};

const MyEvents = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents]     = useState([]);
  const [venues, setVenues]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(initialForm);
  const [saving, setSaving]     = useState(false);

  const load = () =>
    Promise.all([
      api.get('/events'),
      api.get('/events/venues').catch(() => ({ data: [] })),
    ]).then(([ev, vn]) => {
      setEvents(ev.data);
      setVenues(vn.data);
    }).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const today = new Date().toISOString().split('T')[0];
  const filtered = events.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const getStatus = (ev) => {
    if (!ev.is_active) return { label: 'Inactivo', cls: 'bg-gray-700 text-gray-300' };
    const now = new Date();
    if (ev.sale_end_at && now > new Date(ev.sale_end_at)) {
      return { label: 'Venta cerrada', cls: 'bg-red-900/40 text-red-300' };
    }
    if (ev.sale_start_at && now < new Date(ev.sale_start_at)) {
      return { label: 'Venta no inició', cls: 'bg-amber-900/40 text-amber-300' };
    }
    if (ev.date < today) return { label: 'Finalizado', cls: 'bg-gray-700 text-gray-400' };
    return { label: 'Venta abierta', cls: 'bg-emerald-900/60 text-emerald-400' };
  };

  // Form handlers
  const addTicketType = () =>
    setForm(f => ({ ...f, ticket_types: [...f.ticket_types, { name: '', price: '', total_quota: '' }] }));

  const updateTT = (i, field, value) =>
    setForm(f => {
      const tts = [...f.ticket_types];
      tts[i] = { ...tts[i], [field]: value };
      return { ...f, ticket_types: tts };
    });

  const removeTT = (i) =>
    setForm(f => ({ ...f, ticket_types: f.ticket_types.filter((_, idx) => idx !== i) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/events', {
        ...form,
        ticket_types: form.ticket_types.map(tt => ({
          ...tt, price: parseFloat(tt.price), total_quota: parseInt(tt.total_quota),
        })),
      });
      toast.success('Evento creado!');
      setShowForm(false);
      setForm(initialForm);
      load();
      navigate(`/evento/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear evento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-3xl mx-auto lg:max-w-none">
        {/* Greeting */}
        <p className="text-gray-400 text-sm">Hola, <span className="text-white font-medium">{user?.name}</span></p>
        <h1 className="text-2xl font-bold text-white mt-1 mb-5">Tus eventos</h1>

        {/* Search + Create */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Buscar evento"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-10"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="btn-primary shrink-0 flex items-center gap-1.5"
            >
              <span className="text-lg leading-none">+</span>
              <span className="hidden sm:inline">Crear</span>
            </button>
          )}
        </div>

        {/* Create form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="card mb-6 space-y-4 animate-in">
            <h2 className="font-semibold text-lg">Nuevo evento</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Nombre *</label>
                <input className="input" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Sala</label>
                <select className="input" value={form.venue_id}
                  onChange={e => setForm(f => ({ ...f, venue_id: e.target.value }))}>
                  <option value="">Sin sala asignada</option>
                  {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Fecha *</label>
                <input type="date" className="input" required value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Hora de inicio *</label>
                <input type="time" className="input" required value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Apertura de venta *</label>
                <input type="datetime-local" className="input" required value={form.sale_start_at}
                  onChange={e => setForm(f => ({ ...f, sale_start_at: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Cierre de venta *</label>
                <input type="datetime-local" className="input" required value={form.sale_end_at}
                  onChange={e => setForm(f => ({ ...f, sale_end_at: e.target.value }))} />
                <p className="text-xs text-gray-500 mt-1">Despues de esta hora ya no se podran vender entradas, pero si seguir rindiendo.</p>
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm text-gray-400 block mb-1">Descripción</label>
                <textarea className="input" rows={2} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>

            {/* Ticket types */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">Tipos de entrada</label>
                <button type="button" onClick={addTicketType} className="text-xs text-brand hover:underline">+ Agregar tipo</button>
              </div>
              {form.ticket_types.map((tt, i) => (
                <div key={i} className="grid grid-cols-3 gap-3 mb-2">
                  <input className="input" placeholder="Nombre" value={tt.name}
                    onChange={e => updateTT(i, 'name', e.target.value)} required />
                  <input className="input" placeholder="Precio $" type="number" min="0" value={tt.price}
                    onChange={e => updateTT(i, 'price', e.target.value)} required />
                  <div className="flex gap-2">
                    <input className="input" placeholder="Cupo" type="number" min="1" value={tt.total_quota}
                      onChange={e => updateTT(i, 'total_quota', e.target.value)} required />
                    {form.ticket_types.length > 1 && (
                      <button type="button" onClick={() => removeTT(i)} className="text-red-400 hover:text-red-300 px-2">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Creando...' : 'Crear evento'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        )}

        {/* Event list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🎉</p>
            <p className="text-gray-400">{search ? 'No se encontraron eventos' : 'No hay eventos todavía'}</p>
            {!search && user?.role === 'admin' && (
              <button onClick={() => setShowForm(true)} className="btn-primary mt-4">+ Crear primer evento</button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ev => {
              const status = getStatus(ev);
              return (
                <button
                  key={ev.id}
                  onClick={() => navigate(`/evento/${ev.id}`)}
                  className="card w-full text-left hover:border-gray-700 transition-all group cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white group-hover:text-brand transition-colors truncate">
                        {ev.name}
                      </h3>
                      <p className="text-sm text-gray-400 mt-0.5">
                        {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: 'numeric' })}
                        {ev.start_time && ` · ${ev.start_time.slice(0, 5)} hs`}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${status.cls}`}>
                          {status.label}
                        </span>
                        {ev.venue_name && (
                          <span className="text-xs text-gray-500">📍 {ev.venue_name}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <span className="text-lg font-bold text-green-400">{ev.tickets_sold || 0}</span>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide">vendidas</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MyEvents;
