import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';
import { downloadTicketsPdf } from '../../utils/downloadTicketsPdf';

const emptyAttendee = () => ({ buyer_name: '', buyer_apellido: '', buyer_edad: '', buyer_localidad: '', buyer_email: '' });

const Cortesias = () => {
  const [events,      setEvents]      = useState([]);
  const [eventSel,    setEventSel]    = useState('');
  const [ticketTypes, setTicketTypes] = useState([]);
  const [typeSel,     setTypeSel]     = useState('');
  const [attendees,   setAttendees]   = useState([emptyAttendee()]);
  const [saving,      setSaving]      = useState(false);
  const [created,     setCreated]     = useState(null);

  useEffect(() => {
    api.get('/events').then(r => setEvents(r.data.filter(e => e.is_active)));
  }, []);

  useEffect(() => {
    if (!eventSel) { setTicketTypes([]); setTypeSel(''); return; }
    api.get(`/events/${eventSel}`).then(r => setTicketTypes(r.data.ticket_types || []));
  }, [eventSel]);

  const addAttendee    = () => attendees.length < 50 && setAttendees(a => [...a, emptyAttendee()]);
  const removeAttendee = (i) => setAttendees(a => a.filter((_, idx) => idx !== i));
  const updateAt       = (i, field, value) => setAttendees(a => a.map((x, idx) => idx === i ? { ...x, [field]: value } : x));

  const submit = async (e) => {
    e.preventDefault();
    if (!eventSel || !typeSel) return toast.error('Elegi evento y tipo');
    for (let i = 0; i < attendees.length; i++) {
      if (!attendees[i].buyer_name || !attendees[i].buyer_apellido)
        return toast.error(`Falta nombre o apellido en cortesia ${i + 1}`);
    }
    setSaving(true);
    try {
      const r = await api.post('/cortesias', {
        event_id: eventSel, ticket_type_id: typeSel, attendees,
      });
      setCreated(r.data);
      toast.success(`${r.data.tickets.length} cortesia(s) generada(s)`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear cortesias');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setCreated(null);
    setAttendees([emptyAttendee()]);
    setTypeSel('');
  };

  const selectedEvent = events.find(e => e.id === eventSel);
  const selectedType  = ticketTypes.find(t => t.id === typeSel);

  if (created) return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Cortesias generadas</h1>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
          {created.tickets.length} entrada(s) sin costo. Compartiselas a cada invitado.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {created.tickets.map((t, i) => (
            <div key={t.id} className="card text-center space-y-3">
              <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#6B7280' }}>
                Cortesia {i + 1}
              </p>
              <p className="font-bold">{t.buyer_name} {t.buyer_apellido}</p>
              <p className="text-xs" style={{ color: '#C9974D' }}>{t.tipo_entrada} · CORTESIA</p>
              <div id={`qr-pdf-${t.id}`} className="flex justify-center p-3 bg-white rounded-xl">
                <QRCodeSVG
                  value={JSON.stringify({ code: t.qr_code, ticket_id: t.id })}
                  size={160} bgColor="#ffffff" fgColor="#000000"
                />
              </div>
              <p className="font-mono text-xs" style={{ color: '#4B5563' }}>{t.qr_code}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => downloadTicketsPdf({
              tickets: created.tickets,
              eventName: 'Cortesías',
              promoterName: '',
            })}
            className="btn-primary flex-1"
          >
            📄 Descargar PDF
          </button>
          <button onClick={() => window.print()} className="btn-secondary flex-1">🖨️ Imprimir</button>
          <button onClick={reset} className="btn-secondary flex-1">Generar más</button>
        </div>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Cortesias</h1>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
          Genera entradas sin costo. Cada invitado recibe su propio QR para ingresar.
        </p>

        <form onSubmit={submit} className="card space-y-5">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Evento *</label>
            <select className="input" required value={eventSel} onChange={e => setEventSel(e.target.value)}>
              <option value="">Seleccionar evento</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} — {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR')}
                </option>
              ))}
            </select>
          </div>

          {ticketTypes.length > 0 && (
            <div>
              <label className="text-sm text-gray-400 block mb-1">Tipo de entrada *</label>
              <select className="input" required value={typeSel} onChange={e => setTypeSel(e.target.value)}>
                <option value="">Seleccionar tipo</option>
                {ticketTypes.map(tt => (
                  <option key={tt.id} value={tt.id} disabled={tt.available <= 0}>
                    {tt.name} ({tt.available} disp.)
                  </option>
                ))}
              </select>
              {selectedType && (
                <p className="text-xs mt-1" style={{ color: '#C9974D' }}>
                  Precio normal ${parseFloat(selectedType.price).toLocaleString('es-AR')} — la cortesia sale $0
                </p>
              )}
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#6B7280' }}>
                Invitados ({attendees.length})
              </p>
              <button type="button" onClick={addAttendee}
                disabled={attendees.length >= 50}
                className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-30"
                style={{ background: '#1E2530', color: '#C9974D' }}>
                + Agregar
              </button>
            </div>

            {attendees.map((a, i) => (
              <div key={i} className="rounded-lg p-3 space-y-2"
                   style={{ background: '#161B24', border: '1px solid #1E2530' }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold" style={{ color: '#6B7280' }}>Invitado {i + 1}</p>
                  {attendees.length > 1 && (
                    <button type="button" onClick={() => removeAttendee(i)}
                      className="text-xs text-red-400 hover:text-red-300">
                      Quitar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className="input text-sm" required placeholder="Nombre *"
                    value={a.buyer_name}
                    onChange={e => updateAt(i, 'buyer_name', e.target.value)} />
                  <input className="input text-sm" required placeholder="Apellido *"
                    value={a.buyer_apellido}
                    onChange={e => updateAt(i, 'buyer_apellido', e.target.value)} />
                  <input className="input text-sm" placeholder="Edad" inputMode="numeric"
                    value={a.buyer_edad}
                    onChange={e => updateAt(i, 'buyer_edad', e.target.value)} />
                  <input className="input text-sm" placeholder="Localidad"
                    value={a.buyer_localidad}
                    onChange={e => updateAt(i, 'buyer_localidad', e.target.value)} />
                  <input className="input text-sm col-span-2" type="email" placeholder="Email (opcional)"
                    value={a.buyer_email}
                    onChange={e => updateAt(i, 'buyer_email', e.target.value)} />
                </div>
              </div>
            ))}
          </div>

          <button type="submit" disabled={saving || !typeSel} className="btn-primary w-full py-3">
            {saving ? 'Generando...' : `Generar ${attendees.length} cortesia${attendees.length === 1 ? '' : 's'}`}
          </button>
        </form>
      </div>
    </Layout>
  );
};

export default Cortesias;
