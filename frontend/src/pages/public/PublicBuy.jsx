import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const BACKEND = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api');

const METHODS = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
];

const emptyForm = {
  ticket_type_id: '', buyer_name: '', buyer_apellido: '',
  buyer_dni: '', buyer_celular: '', buyer_email: '',
  payment_method: 'efectivo',
};

const PublicBuy = () => {
  const { code } = useParams();
  const [promotor,     setPromotor]     = useState(null);
  const [events,       setEvents]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [eventSel,     setEventSel]     = useState('');
  const [ticketTypes,  setTicketTypes]  = useState([]);
  const [form,         setForm]         = useState(emptyForm);
  const [saving,       setSaving]       = useState(false);
  const [created,      setCreated]      = useState(null);
  const [formError,    setFormError]    = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND}/public/promotor/${code}`).then(r => r.json()),
      fetch(`${BACKEND}/public/events`).then(r => r.json()),
    ])
      .then(([promo, evs]) => {
        if (promo.error) { setError('Link no válido o expirado.'); return; }
        setPromotor(promo);
        const list = Array.isArray(evs) ? evs : [];
        setEvents(list);
        if (list.length === 1) {
          setEventSel(list[0].id);
          setTicketTypes(list[0].ticket_types || []);
        }
      })
      .catch(() => setError('No se pudo cargar la página.'))
      .finally(() => setLoading(false));
  }, [code]);

  const handleEventChange = (id) => {
    setEventSel(id);
    const ev = events.find(e => e.id === id);
    setTicketTypes(ev?.ticket_types || []);
    setForm(f => ({ ...f, ticket_type_id: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const r = await fetch(`${BACKEND}/public/tickets/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, event_id: eventSel }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Error al registrar');
      setCreated(data);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleNew = () => {
    setCreated(null);
    setForm(emptyForm);
  };

  const selectedType = ticketTypes.find(t => t.id === form.ticket_type_id);
  const selectedEvent = events.find(e => e.id === eventSel);

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center space-y-3">
        <p className="text-4xl font-black text-brand">GianQR</p>
        <p className="text-red-400">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-3xl font-black text-brand tracking-tight">GianQR</p>
          <p className="text-sm text-gray-400 mt-1">Registro de entrada</p>
          {promotor && (
            <p className="text-xs text-gray-500 mt-2">
              Vendedor: <span className="text-gray-300">{promotor.name} {promotor.apellido || ''}</span>
            </p>
          )}
        </div>

        {created ? (
          <div className="card text-center space-y-5">
            <div>
              <div className="w-12 h-12 rounded-full bg-green-900/40 border border-green-700/50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold">Entrada registrada</h2>
              <p className="text-sm text-gray-400 mt-1">
                {created.buyer_name} {created.buyer_apellido}
              </p>
              <p className="text-xs text-gray-500">{created.tipo_entrada} · ${parseFloat(created.amount_paid).toLocaleString('es-AR')}</p>
            </div>

            <div className="flex justify-center p-4 bg-white rounded-xl">
              <QRCodeSVG
                value={JSON.stringify({ code: created.qr_code, ticket_id: created.id })}
                size={200}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>

            <p className="font-mono text-xs text-gray-500">{created.qr_code}</p>

            <p className="text-xs text-gray-500">
              Guardá una captura de pantalla de este QR. Lo vas a necesitar en la entrada del evento.
            </p>

            <div className="flex gap-3">
              <button onClick={handleNew} className="btn-primary flex-1">
                Registrar otra persona
              </button>
              <button onClick={() => window.print()} className="btn-secondary flex-1">
                Imprimir
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-5">
            {/* Evento */}
            {events.length > 1 && (
              <div>
                <label className="text-sm text-gray-400 block mb-1">Evento</label>
                <select className="input" required value={eventSel} onChange={e => handleEventChange(e.target.value)}>
                  <option value="">Seleccionar evento</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} — {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {events.length === 1 && selectedEvent && (
              <div className="p-3 bg-gray-800/60 rounded-lg border border-gray-700/50">
                <p className="font-semibold text-sm">{selectedEvent.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(selectedEvent.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {selectedEvent.venue_name ? ` · ${selectedEvent.venue_name}` : ''}
                </p>
              </div>
            )}

            {/* Tipo de entrada */}
            {ticketTypes.length > 0 && (
              <div>
                <label className="text-sm text-gray-400 block mb-1">Tipo de entrada</label>
                <select className="input" required value={form.ticket_type_id}
                  onChange={e => setForm(f => ({ ...f, ticket_type_id: e.target.value }))}>
                  <option value="">Seleccionar tipo</option>
                  {ticketTypes.map(tt => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name} — ${parseFloat(tt.price).toLocaleString('es-AR')} ({tt.available} disp.)
                    </option>
                  ))}
                </select>
                {selectedType && (
                  <p className="text-xs text-brand mt-1 font-medium">
                    ${parseFloat(selectedType.price).toLocaleString('es-AR')}
                  </p>
                )}
              </div>
            )}

            {/* Datos personales */}
            <div className="space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium border-t border-gray-800 pt-4">
                Tus datos
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Nombre *</label>
                  <input className="input" required placeholder="Juan" value={form.buyer_name}
                    onChange={e => setForm(f => ({ ...f, buyer_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Apellido *</label>
                  <input className="input" required placeholder="García" value={form.buyer_apellido}
                    onChange={e => setForm(f => ({ ...f, buyer_apellido: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">DNI *</label>
                  <input className="input" required inputMode="numeric" placeholder="12345678"
                    value={form.buyer_dni}
                    onChange={e => setForm(f => ({ ...f, buyer_dni: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Celular *</label>
                  <input className="input" required inputMode="tel" placeholder="2645 123456"
                    value={form.buyer_celular}
                    onChange={e => setForm(f => ({ ...f, buyer_celular: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Email <span className="text-gray-600">(opcional)</span></label>
                <input type="email" className="input" placeholder="tu@email.com"
                  value={form.buyer_email}
                  onChange={e => setForm(f => ({ ...f, buyer_email: e.target.value }))} />
              </div>
            </div>

            {/* Método de pago */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Forma de pago</label>
              <div className="flex gap-2">
                {METHODS.map(m => (
                  <button type="button" key={m.value}
                    onClick={() => setForm(f => ({ ...f, payment_method: m.value }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      form.payment_method === m.value
                        ? 'bg-brand border-brand text-white'
                        : 'border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {formError && (
              <p className="text-sm text-red-400 text-center">{formError}</p>
            )}

            <button
              type="submit"
              disabled={saving || !form.ticket_type_id || !eventSel}
              className="btn-primary w-full py-3 text-base font-semibold"
            >
              {saving ? 'Registrando...' : 'Registrar entrada'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-700 mt-6">GianQR — Sistema de Entradas</p>
      </div>
    </div>
  );
};

export default PublicBuy;
