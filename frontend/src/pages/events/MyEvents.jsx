import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { SkeletonEventCard } from '../../components/Skeleton';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import PullIndicator from '../../components/PullIndicator';

const initialForm = {
  name: '', description: '', date: '', start_time: '', end_time: '',
  sale_start_at: '', sale_end_at: '',
  flyer_url: '',
  ticket_types: [{ name: 'General', price: '', total_quota: '' }],
};

const MyEvents = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);   // null = nuevo, id = editando
  const [form, setForm]         = useState(initialForm);
  const [saving, setSaving]     = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneSrcId, setCloneSrcId]   = useState('');
  const [cloneForm, setCloneForm]     = useState({ name: '', date: '', start_time: '', end_time: '', sale_start_at: '', sale_end_at: '' });
  const [cloning, setCloning]         = useState(false);
  // Estado del boton "Descargar Excel" dentro del modal de reciclar.
  // Cargamos exceljs lazy en el util — el chunk no se baja hasta apretar.
  const [exporting, setExporting]     = useState(false);

  const load = () =>
    api.get('/events')
      .then(ev => setEvents(ev.data))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  // Pull-to-refresh: tira del top de la lista para refrescar sin reload.
  const { pulling, progress } = usePullToRefresh(() => load());

  // Si llegan desde EventDashboard con ?edit=ID, abrimos directo el modal
  // de edicion del evento. Limpiamos el query string para que no quede pegajoso.
  useEffect(() => {
    const editIdQuery = searchParams.get('edit');
    if (!editIdQuery || events.length === 0) return;
    const ev = events.find(e => String(e.id) === String(editIdQuery));
    if (ev) {
      openEdit(ev);
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

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

  const openNew = () => {
    setEditId(null);
    setForm(initialForm);
    setShowForm(true);
  };

  const openEdit = (ev) => {
    // Admin y owner pueden editar (owner solo SUS eventos — backend lo valida)
    if (!['admin','owner'].includes(user?.role)) return;
    setEditId(ev.id);
    setForm({
      name: ev.name || '',
      description: ev.description || '',
      date: ev.date || '',
      start_time: (ev.start_time || '').slice(0, 5),
      end_time: (ev.end_time || '').slice(0, 5),
      sale_start_at: ev.sale_start_at ? ev.sale_start_at.slice(0, 16) : '',
      sale_end_at: ev.sale_end_at ? ev.sale_end_at.slice(0, 16) : '',
      flyer_url: ev.flyer_url || '',
      ticket_types: [],  // En edit no tocamos tipos (van a /evento/:id/tipos)
      is_active: ev.is_active !== 0,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(initialForm);
  };

  // ---- Reciclar evento anterior ----
  const openClone = () => {
    setCloneSrcId('');
    setCloneForm({ name: '', date: '', start_time: '', end_time: '', sale_start_at: '', sale_end_at: '' });
    setShowCloneModal(true);
  };
  const cancelClone = () => { setShowCloneModal(false); setCloneSrcId(''); };
  // Pre-rellena con el nombre del original "<nombre> (nuevo)" cuando elegís uno.
  const handleSelectSource = (id) => {
    setCloneSrcId(id);
    const src = events.find(e => e.id === id);
    if (src) setCloneForm(f => ({ ...f, name: f.name || `${src.name} (nuevo)` }));
  };
  const submitClone = async (e) => {
    e.preventDefault();
    if (!cloneSrcId) return toast.error('Elegí qué evento querés reciclar');
    setCloning(true);
    try {
      const res = await api.post(`/events/${cloneSrcId}/clone`, cloneForm);
      toast.success(`Evento creado. Se copiaron ${res.data.ticket_types_copied || 0} tipos de entrada.`);
      cancelClone();
      load();
      navigate(`/evento/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al reciclar evento');
    } finally {
      setCloning(false);
    }
  };

  // Descargar Excel del evento ORIGEN antes de reciclarlo. Asi el owner se
  // lleva un snapshot de las ventas, comisiones y demograficas como
  // archivo offline antes de "olvidarse" del evento.
  const handleExportSrc = async () => {
    if (!cloneSrcId) return toast.error('Elegí qué evento querés exportar');
    setExporting(true);
    try {
      const { exportEventXlsx } = await import('../../utils/exportEventXlsx');
      const r = await exportEventXlsx(cloneSrcId);
      toast.success(`Excel descargado (${r.tickets} entradas)`);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo generar el Excel');
    } finally {
      setExporting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        // EDIT — no manda ticket_types (se gestionan aparte)
        await api.put(`/events/${editId}`, {
          name: form.name,
          description: form.description || null,
          date: form.date,
          start_time: form.start_time,
          end_time: form.end_time || null,
          flyer_url: form.flyer_url || null,
          is_active: form.is_active,
          sale_start_at: form.sale_start_at || null,
          sale_end_at: form.sale_end_at || null,
        });
        toast.success('Evento actualizado!');
        cancelForm();
        load();
      } else {
        // CREATE
        const res = await api.post('/events', {
          ...form,
          ticket_types: form.ticket_types.map(tt => ({
            ...tt, price: parseFloat(tt.price), total_quota: parseInt(tt.total_quota),
          })),
        });
        toast.success('Evento creado!');
        cancelForm();
        load();
        navigate(`/evento/${res.data.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar evento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <PullIndicator pulling={pulling} progress={progress} />
      <div className="px-4 lg:px-8 py-6 max-w-3xl mx-auto lg:max-w-none">
        {/* Greeting */}
        <p className="text-gray-400 text-sm">Hola, <span className="text-white font-medium">{user?.name}</span></p>
        <h1 className="text-2xl font-bold text-white mt-1 mb-5">Tus eventos</h1>

        {/* Search + Create */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <input
              type="search"
              enterKeyHint="search"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              placeholder="Buscar evento"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input pl-10"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {['admin','owner'].includes(user?.role) && !showForm && !showCloneModal && (
            <>
              {events.length > 0 && (
                <button
                  onClick={openClone}
                  className="btn-secondary shrink-0 flex items-center gap-1.5"
                  title="Crear un evento nuevo copiando los tipos de entrada y dueños de uno anterior"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M4 20l16-16" />
                  </svg>
                  <span className="hidden sm:inline">Reciclar</span>
                </button>
              )}
              <button
                onClick={openNew}
                className="btn-primary shrink-0 flex items-center gap-1.5"
              >
                <span className="text-lg leading-none">+</span>
                <span className="hidden sm:inline">Crear</span>
              </button>
            </>
          )}
        </div>

        {/* Create/Edit form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="card mb-6 space-y-4 animate-in">
            <h2 className="font-semibold text-lg">
              {editId ? `✏️ Editar evento — ${form.name}` : 'Nuevo evento'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Nombre *</label>
                <input className="input" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
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

            {/* Ticket types — solo en CREATE. En edit se gestionan en /evento/:id/tipos */}
            {!editId && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Tipos de entrada</label>
                  <button type="button" onClick={addTicketType} className="text-xs text-brand hover:underline">+ Agregar tipo</button>
                </div>
                {form.ticket_types.map((tt, i) => (
                  <div key={i} className="grid grid-cols-3 gap-3 mb-2">
                    <input className="input" placeholder="Nombre" value={tt.name}
                      onChange={e => updateTT(i, 'name', e.target.value)} required />
                    <input className="input" placeholder="Precio $" type="number" inputMode="decimal" min="0" value={tt.price}
                      onChange={e => updateTT(i, 'price', e.target.value)} required />
                    <div className="flex gap-2">
                      <input className="input" placeholder="Cupo" type="number" inputMode="numeric" min="1" value={tt.total_quota}
                        onChange={e => updateTT(i, 'total_quota', e.target.value)} required />
                      {form.ticket_types.length > 1 && (
                        <button type="button" onClick={() => removeTT(i)} className="text-red-400 hover:text-red-300 px-2">✕</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {editId && (
              <p className="text-xs text-gray-500">Los tipos de entrada (nombre, precio, cupo) se editan desde el evento → <span className="text-brand">🏷️ Tandas de entradas</span>.</p>
            )}

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex-1">
                {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Crear evento'}
              </button>
              <button type="button" onClick={cancelForm} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        )}

        {/* Clone form: reciclar evento anterior */}
        {showCloneModal && (
          <form onSubmit={submitClone} className="card mb-6 space-y-4 animate-in">
            <div>
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6M4 20l16-16" />
                </svg>
                Reciclar evento anterior
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Copia tipos de entrada (nombres, precios, cupos) y dueños del evento elegido.
                Ticktets, ventas y rendiciones <strong>no se copian</strong>.
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-400 block mb-1">Evento a reciclar *</label>
              <select className="input" required value={cloneSrcId} onChange={e => handleSelectSource(e.target.value)}>
                <option value="">Elegí uno</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} — {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR')}
                  </option>
                ))}
              </select>
              {/* Antes de reciclar conviene descargar todo el historial del evento
                  origen, porque despues solo queda en la base. El boton solo se
                  activa cuando se eligio uno. Restringido a role=owner: el admin
                  ve la pantalla pero el export es solo para el dueño del evento. */}
              {cloneSrcId && user?.role === 'owner' && (
                <button type="button" onClick={handleExportSrc} disabled={exporting}
                        className="btn-secondary text-xs mt-2 w-full sm:w-auto disabled:opacity-40">
                  {exporting ? 'Generando...' : '📊 Descargar Excel del evento origen'}
                </button>
              )}
              <p className="text-[10px] mt-1.5" style={{ color: '#4B5563' }}>
                Te llevás un Excel con resumen, entradas, demografía y ventas por vendedor del evento que estás reciclando.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-sm text-gray-400 block mb-1">Nombre del nuevo evento *</label>
                <input className="input" required value={cloneForm.name}
                  onChange={e => setCloneForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Fecha *</label>
                <input type="date" className="input" required value={cloneForm.date}
                  onChange={e => setCloneForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Hora de inicio *</label>
                <input type="time" className="input" required value={cloneForm.start_time}
                  onChange={e => setCloneForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Apertura de venta *</label>
                <input type="datetime-local" className="input" required value={cloneForm.sale_start_at}
                  onChange={e => setCloneForm(f => ({ ...f, sale_start_at: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Cierre de venta *</label>
                <input type="datetime-local" className="input" required value={cloneForm.sale_end_at}
                  onChange={e => setCloneForm(f => ({ ...f, sale_end_at: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={cloning} className="btn-primary flex-1">
                {cloning ? 'Creando...' : 'Reciclar y crear'}
              </button>
              <button type="button" onClick={cancelClone} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        )}

        {/* Event list */}
        {loading ? (
          // 5 skeletons imitan el alto de un card de evento. El usuario ve
          // la "forma" de la lista y la transicion a data se siente fluida.
          <div>{Array.from({ length: 5 }).map((_, i) => <SkeletonEventCard key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🎉</p>
            <p className="text-gray-400">{search ? 'No se encontraron eventos' : 'No hay eventos todavía'}</p>
            {!search && ['admin','owner'].includes(user?.role) && (
              <button onClick={openNew} className="btn-primary mt-4">+ Crear primer evento</button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(ev => {
              const status = getStatus(ev);
              return (
                <div
                  key={ev.id}
                  className="card w-full text-left hover:border-gray-700 transition-all group cursor-pointer active:scale-[0.98] relative"
                  onClick={() => navigate(`/evento/${ev.id}`)}
                >
                  {user?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEdit(ev); }}
                      className="absolute top-3 right-3 p-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-700 text-gray-300 transition-colors z-10"
                      title="Editar evento"
                    >
                      ✏️
                    </button>
                  )}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-12">
                      <h3 className="font-semibold text-white group-hover:text-brand transition-colors truncate">
                        {ev.name}
                      </h3>
                      <p className="text-sm text-gray-400 mt-0.5">
                        {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', year: 'numeric' })}
                        {ev.start_time && ` · ${ev.start_time.slice(0, 5)} hs`}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${status.cls}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                    {/* Contador de vendidas: solo admin/owner. Jefe/vendedor
                        ven la lista de eventos sin saber cuanto se vendio. */}
                    {['admin','owner'].includes(user?.role) && (
                      <div className="text-right shrink-0 ml-4 mt-6">
                        <span className="text-lg font-bold text-green-400">{ev.tickets_sold || 0}</span>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">vendidas</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MyEvents;
