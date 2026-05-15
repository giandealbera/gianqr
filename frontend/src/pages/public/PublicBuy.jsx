import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

const BACKEND = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api');

const emptyAttendee = () => ({
  buyer_name: '', buyer_apellido: '',
  buyer_edad: '', buyer_localidad: '', buyer_email: '',
});

const PublicBuy = () => {
  const { code }       = useParams();
  const [searchParams] = useSearchParams();
  const presetEventId  = searchParams.get('event') || '';
  const presetTypeId   = searchParams.get('type')  || '';
  const presetQty      = Math.min(Math.max(parseInt(searchParams.get('qty') || '1', 10) || 1, 1), 10);
  const presetPay      = searchParams.get('pay') || 'efectivo';

  const [promotor,    setPromotor]    = useState(null);
  const [events,      setEvents]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [eventSel,    setEventSel]    = useState(presetEventId);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [typeSel,     setTypeSel]     = useState(presetTypeId);
  const [attendees,   setAttendees]   = useState(
    Array.from({ length: presetQty }, emptyAttendee)
  );
  const [saving,      setSaving]      = useState(false);
  const [created,     setCreated]     = useState(null);
  const [formError,   setFormError]   = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${BACKEND}/public/promotor/${code}`).then(r => r.json()),
      fetch(`${BACKEND}/public/events`).then(r => r.json()),
    ])
      .then(([promo, evs]) => {
        if (promo.error) { setError('Link no valido o expirado.'); return; }
        setPromotor(promo);
        const list = Array.isArray(evs) ? evs : [];
        setEvents(list);
        const target = presetEventId
          ? list.find(e => e.id === presetEventId)
          : list.length === 1 ? list[0] : null;
        if (target) {
          setEventSel(target.id);
          const types = target.ticket_types || [];
          setTicketTypes(types);
          if (presetTypeId && types.find(t => t.id === presetTypeId)) setTypeSel(presetTypeId);
          else if (types.length === 1) setTypeSel(types[0].id);
        }
      })
      .catch(() => setError('No se pudo cargar la pagina.'))
      .finally(() => setLoading(false));
  }, [code]);

  const handleEventChange = (id) => {
    setEventSel(id);
    setTypeSel('');
    const ev = events.find(e => e.id === id);
    setTicketTypes(ev?.ticket_types || []);
  };

  const updateAttendee = (i, field, value) => {
    setAttendees(arr => arr.map((a, idx) => idx === i ? { ...a, [field]: value } : a));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!eventSel || !typeSel) { setFormError('Selecciona el evento y tipo de entrada'); return; }
    // validar todos los attendees
    for (let i = 0; i < attendees.length; i++) {
      if (!attendees[i].buyer_name || !attendees[i].buyer_apellido) {
        setFormError(`Falta nombre o apellido en la persona ${i + 1}`);
        return;
      }
    }
    setSaving(true);
    try {
      const r = await fetch(`${BACKEND}/public/tickets/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventSel,
          ticket_type_id: typeSel,
          payment_method: presetPay,
          attendees,
        }),
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
    setAttendees(Array.from({ length: presetQty }, emptyAttendee));
  };

  const selectedType  = ticketTypes.find(t => t.id === typeSel);
  const selectedEvent = events.find(e => e.id === eventSel);
  const eventLocked   = !!presetEventId && !!selectedEvent;
  const typeLocked    = !!presetTypeId  && !!selectedType;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#07090E' }}>
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#07090E' }}>
      <div className="text-center space-y-3">
        <p className="text-4xl font-black text-brand">GianQR</p>
        <p className="text-red-400">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: '#07090E' }}>
      <div className="max-w-md mx-auto">

        <div className="text-center mb-8">
          <p className="text-3xl font-black tracking-tight" style={{ color: '#C9974D' }}>GianQR</p>
          <p className="text-sm mt-1" style={{ color: '#4B5568' }}>Registro de entrada</p>
        </div>

        {created ? (
          <div className="space-y-4">
            <div className="card text-center space-y-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                   style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)' }}>
                <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold">
                {created.tickets.length === 1 ? 'Entrada registrada' : `${created.tickets.length} entradas registradas`}
              </h2>
              <p className="text-xs" style={{ color: '#6B7280' }}>
                Total: ${parseFloat(created.total).toLocaleString('es-AR')}
              </p>
              <p className="text-xs" style={{ color: '#4B5563' }}>
                Guarda una captura de cada QR. Cada persona necesita el suyo para entrar.
              </p>
            </div>

            {created.tickets.map((t, i) => (
              <div key={t.id} className="card text-center space-y-3">
                <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#6B7280' }}>
                  Entrada {i + 1} de {created.tickets.length}
                </p>
                <p className="font-bold">{t.buyer_name} {t.buyer_apellido}</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>
                  {t.tipo_entrada} · ${parseFloat(t.amount_paid).toLocaleString('es-AR')}
                </p>
                <div className="flex justify-center p-3 bg-white rounded-xl">
                  <QRCodeSVG
                    value={JSON.stringify({ code: t.qr_code, ticket_id: t.id })}
                    size={180} bgColor="#ffffff" fgColor="#000000"
                  />
                </div>
                <p className="font-mono text-xs" style={{ color: '#4B5563' }}>{t.qr_code}</p>
              </div>
            ))}

            <div className="flex gap-3">
              <button onClick={handleNew} className="btn-primary flex-1">Otra compra</button>
              <button onClick={() => window.print()} className="btn-secondary flex-1">Imprimir</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-5">

            {!eventLocked && events.length > 1 && (
              <div>
                <label className="text-sm text-gray-400 block mb-1">Evento *</label>
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

            {selectedEvent && (
              <div className="rounded-lg p-3" style={{ background: '#161B24', border: '1px solid #1E2530' }}>
                <p className="font-semibold text-sm">{selectedEvent.name}</p>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                  {new Date(selectedEvent.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  {selectedEvent.venue_name ? ` · ${selectedEvent.venue_name}` : ''}
                </p>
                {typeLocked && selectedType && (
                  <p className="text-xs mt-1 font-medium" style={{ color: '#C9974D' }}>
                    {selectedType.name} — ${parseFloat(selectedType.price).toLocaleString('es-AR')} c/u
                    {attendees.length > 1 && ` · ${attendees.length} entradas`}
                  </p>
                )}
              </div>
            )}

            {!typeLocked && ticketTypes.length > 0 && (
              <div>
                <label className="text-sm text-gray-400 block mb-1">Tipo de entrada *</label>
                <select className="input" required value={typeSel} onChange={e => setTypeSel(e.target.value)}>
                  <option value="">Seleccionar tipo</option>
                  {ticketTypes.map(tt => (
                    <option key={tt.id} value={tt.id} disabled={tt.available <= 0}>
                      {tt.name} — ${parseFloat(tt.price).toLocaleString('es-AR')} ({tt.available} disp.)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Formularios por persona */}
            {attendees.map((a, i) => (
              <div key={i} className="space-y-3">
                <p className="text-xs uppercase tracking-widest font-semibold pt-1"
                   style={{ color: '#4B5563', borderTop: '1px solid #1E2530', paddingTop: '1rem' }}>
                  Persona {i + 1}{attendees.length > 1 ? ` de ${attendees.length}` : ''}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Nombre *</label>
                    <input className="input" required placeholder="Juan" value={a.buyer_name}
                      onChange={e => updateAttendee(i, 'buyer_name', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Apellido *</label>
                    <input className="input" required placeholder="Garcia" value={a.buyer_apellido}
                      onChange={e => updateAttendee(i, 'buyer_apellido', e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Edad</label>
                    <input className="input" inputMode="numeric" placeholder="25" value={a.buyer_edad}
                      onChange={e => updateAttendee(i, 'buyer_edad', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Localidad</label>
                    <input className="input" placeholder="San Juan" value={a.buyer_localidad}
                      onChange={e => updateAttendee(i, 'buyer_localidad', e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">
                    Email <span style={{ color: '#4B5563' }}>(opcional)</span>
                  </label>
                  <input type="email" className="input" placeholder="tu@email.com" value={a.buyer_email}
                    onChange={e => updateAttendee(i, 'buyer_email', e.target.value)} />
                </div>
              </div>
            ))}

            {formError && (
              <p className="text-sm text-red-400 text-center">{formError}</p>
            )}

            <button
              type="submit"
              disabled={saving || !typeSel || !eventSel}
              className="btn-primary w-full py-3 text-base font-semibold"
            >
              {saving
                ? 'Registrando...'
                : `Obtener ${attendees.length === 1 ? 'mi entrada' : `${attendees.length} entradas`}`}
            </button>
          </form>
        )}

        <p className="text-center text-xs mt-6" style={{ color: '#1E2530' }}>GianQR — Sistema de Entradas</p>
      </div>
    </div>
  );
};

export default PublicBuy;
