import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';

const initialForm = {
  name: '', description: '', date: '', start_time: '', end_time: '',
  venue_id: '', flyer_url: '',
  ticket_types: [{ name: 'General', price: '', total_quota: '' }],
};

const Events = () => {
  const [events,  setEvents]  = useState([]);
  const [venues,  setVenues]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const load = () =>
    Promise.all([
      api.get('/events'),
      api.get('/events/venues'),
    ]).then(([ev, vn]) => {
      setEvents(ev.data);
      setVenues(vn.data);
    }).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

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
      await api.post('/events', {
        ...form,
        ticket_types: form.ticket_types.map(tt => ({
          ...tt,
          price:       parseFloat(tt.price),
          total_quota: parseInt(tt.total_quota),
        })),
      });
      toast.success('Evento creado!');
      setShowForm(false);
      setForm(initialForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear evento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Eventos</h1>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? 'Cancelar' : '+ Nuevo evento'}
          </button>
        </div>

        {/* Formulario nuevo evento */}
        {showForm && (
          <form onSubmit={handleSubmit} className="card mb-8 space-y-4">
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
              <div className="sm:col-span-2">
                <label className="text-sm text-gray-400 block mb-1">Descripción</label>
                <textarea className="input" rows={2} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>

            {/* Tipos de entrada */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-300">Tipos de entrada</label>
                <button type="button" onClick={addTicketType}
                  className="text-xs text-brand hover:underline">+ Agregar tipo</button>
              </div>
              {form.ticket_types.map((tt, i) => (
                <div key={i} className="grid grid-cols-3 gap-3 mb-2">
                  <input className="input" placeholder="Nombre (ej: VIP)" value={tt.name}
                    onChange={e => updateTT(i, 'name', e.target.value)} required />
                  <input className="input" placeholder="Precio $" type="number" min="0" value={tt.price}
                    onChange={e => updateTT(i, 'price', e.target.value)} required />
                  <div className="flex gap-2">
                    <input className="input" placeholder="Cupo" type="number" min="1" value={tt.total_quota}
                      onChange={e => updateTT(i, 'total_quota', e.target.value)} required />
                    {form.ticket_types.length > 1 && (
                      <button type="button" onClick={() => removeTT(i)}
                        className="text-red-400 hover:text-red-300 px-2">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Guardando...' : 'Crear evento'}
            </button>
          </form>
        )}

        {/* Lista de eventos */}
        {loading ? (
          <p className="text-gray-500">Cargando...</p>
        ) : (
          <div className="space-y-3">
            {events.map(ev => (
              <div key={ev.id} className="card flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{ev.name}</span>
                    {!ev.is_active && <span className="badge-cancelado">Inactivo</span>}
                  </div>
                  <div className="text-sm text-gray-400 mt-0.5">
                    {ev.venue_name && <span className="mr-3">📍 {ev.venue_name}</span>}
                    <span>📅 {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR')}</span>
                    <span className="ml-3">🕐 {ev.start_time?.slice(0,5)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-green-400 font-bold">{ev.tickets_sold || 0} vendidas</div>
                  <Link to={`/admin/eventos/${ev.id}`}
                    className="text-xs text-brand hover:underline">Ver detalle →</Link>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <p className="text-gray-500 text-center py-8">No hay eventos todavía.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Events;
