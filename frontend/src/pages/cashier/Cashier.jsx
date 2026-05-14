import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';

const HOUSE_CODE = 'CASA';

const Cashier = () => {
  const [searchParams] = useSearchParams();
  const preselectedEvent = searchParams.get('event') || '';

  const [events,       setEvents]       = useState([]);
  const [eventSel,     setEventSel]     = useState(preselectedEvent);
  const [ticketTypes,  setTicketTypes]  = useState([]);
  const [typeSel,      setTypeSel]      = useState('');

  useEffect(() => {
    api.get('/events').then(r => setEvents(r.data.filter(e => e.is_active)));
  }, []);

  useEffect(() => {
    if (!eventSel) { setTicketTypes([]); setTypeSel(''); return; }
    api.get(`/events/${eventSel}`).then(r => setTicketTypes(r.data.ticket_types || []));
  }, [eventSel]);

  const selectedType  = ticketTypes.find(t => t.id === typeSel);
  const selectedEvent = events.find(e => e.id === eventSel);

  // Link de compra publica con evento + tipo preseleccionados
  const buyLink = eventSel && typeSel
    ? `${window.location.origin}/comprar/${HOUSE_CODE}?event=${eventSel}&type=${typeSel}`
    : eventSel
    ? `${window.location.origin}/comprar/${HOUSE_CODE}?event=${eventSel}`
    : '';

  const copyLink = () => {
    if (!buyLink) return;
    navigator.clipboard.writeText(buyLink).then(() => toast.success('Link copiado'));
  };

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Caja</h1>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
          Elegi el evento y el tipo. El comprador escanea el QR (o abre el link) y completa sus propios datos.
        </p>

        <div className="card space-y-5">
          {/* Evento */}
          <div>
            <label className="text-sm text-gray-400 block mb-1">Evento *</label>
            <select className="input" value={eventSel}
              onChange={e => setEventSel(e.target.value)}>
              <option value="">Seleccionar evento</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} — {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR')}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          {ticketTypes.length > 0 && (
            <div>
              <label className="text-sm text-gray-400 block mb-1">Tipo de entrada (opcional)</label>
              <select className="input" value={typeSel}
                onChange={e => setTypeSel(e.target.value)}>
                <option value="">El comprador elige el tipo</option>
                {ticketTypes.map(tt => (
                  <option key={tt.id} value={tt.id} disabled={tt.available <= 0}>
                    {tt.name} — ${parseFloat(tt.price).toLocaleString('es-AR')} ({tt.available} disp.)
                  </option>
                ))}
              </select>
              {selectedType && (
                <p className="text-xs text-brand mt-1">
                  Precio: ${parseFloat(selectedType.price).toLocaleString('es-AR')}
                </p>
              )}
            </div>
          )}

          {/* QR + link */}
          {buyLink ? (
            <div className="space-y-4 pt-2 border-t border-gray-800">
              <p className="text-xs uppercase tracking-widest font-semibold text-center" style={{ color: '#6B7280' }}>
                Que el comprador escanee este QR
              </p>
              <div className="flex justify-center p-4 bg-white rounded-xl">
                <QRCodeSVG value={buyLink} size={220} bgColor="#ffffff" fgColor="#000000" />
              </div>

              <div className="rounded-lg p-3 break-all font-mono text-xs"
                   style={{ background: '#161B24', border: '1px solid #1E2530', color: '#C9974D' }}>
                {buyLink}
              </div>

              <button onClick={copyLink} className="btn-primary w-full py-3">
                Copiar link
              </button>

              <p className="text-xs text-center" style={{ color: '#4B5563' }}>
                {selectedEvent?.name}{selectedType ? ` · ${selectedType.name}` : ''} — el comprador completa nombre, apellido, edad, localidad, email y forma de pago
              </p>
            </div>
          ) : (
            <p className="text-sm text-center py-4" style={{ color: '#4B5563' }}>
              Seleccioná un evento para mostrar el QR de compra
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Cashier;
