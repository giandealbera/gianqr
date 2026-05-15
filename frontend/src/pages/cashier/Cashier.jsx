import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';

const HOUSE_CODE = 'CASA';
const METHODS = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
];

const Cashier = () => {
  const [searchParams] = useSearchParams();
  const [events,      setEvents]      = useState([]);
  const [eventSel,    setEventSel]    = useState(searchParams.get('event') || '');
  const [ticketTypes, setTicketTypes] = useState([]);
  const [typeSel,     setTypeSel]     = useState('');
  const [qty,         setQty]         = useState(1);
  const [payMethod,   setPayMethod]   = useState('efectivo');

  useEffect(() => {
    api.get('/events').then(r => setEvents(r.data.filter(e => e.is_active)));
  }, []);

  useEffect(() => {
    if (!eventSel) { setTicketTypes([]); setTypeSel(''); return; }
    api.get(`/events/${eventSel}`).then(r => setTicketTypes(r.data.ticket_types || []));
  }, [eventSel]);

  const selectedType  = ticketTypes.find(t => t.id === typeSel);
  const selectedEvent = events.find(e => e.id === eventSel);
  const totalPrice    = selectedType ? parseFloat(selectedType.price) * qty : 0;

  const buyLink = eventSel && typeSel
    ? `${window.location.origin}/comprar/${HOUSE_CODE}?event=${eventSel}&type=${typeSel}&qty=${qty}&pay=${payMethod}`
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
          Definí evento, tipo, cantidad y forma de pago. El comprador escanea el QR y completa sus propios datos.
        </p>

        <div className="card space-y-5">
          {/* Evento */}
          <div>
            <label className="text-sm text-gray-400 block mb-1">Evento *</label>
            <select className="input" value={eventSel} onChange={e => setEventSel(e.target.value)}>
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
              <label className="text-sm text-gray-400 block mb-1">Tipo de entrada *</label>
              <select className="input" value={typeSel} onChange={e => setTypeSel(e.target.value)}>
                <option value="">Seleccionar tipo</option>
                {ticketTypes.map(tt => (
                  <option key={tt.id} value={tt.id} disabled={tt.available <= 0}>
                    {tt.name} — ${parseFloat(tt.price).toLocaleString('es-AR')} ({tt.available} disp.)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cantidad + Pago */}
          {typeSel && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Cantidad *</label>
                <select className="input" value={qty} onChange={e => setQty(parseInt(e.target.value, 10))}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <option key={n} value={n}>{n} {n === 1 ? 'entrada' : 'entradas'}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Forma de pago *</label>
                <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Total */}
          {selectedType && (
            <div className="rounded-lg p-3 flex justify-between items-center"
                 style={{ background: '#161B24', border: '1px solid #1E2530' }}>
              <span className="text-sm" style={{ color: '#6B7280' }}>Total a cobrar</span>
              <span className="text-lg font-black" style={{ color: '#C9974D' }}>
                ${totalPrice.toLocaleString('es-AR')}
              </span>
            </div>
          )}

          {/* QR + link */}
          {buyLink ? (
            <div className="space-y-4 pt-2 border-t border-gray-800">
              <p className="text-xs uppercase tracking-widest font-semibold text-center" style={{ color: '#6B7280' }}>
                Link de compra — que el comprador lo escanee con su celular
              </p>
              <p className="text-[10px] text-center -mt-2" style={{ color: '#4B5563' }}>
                (Esto NO es la entrada — el comprador genera su propio QR al cargar sus datos)
              </p>
              <div className="flex justify-center p-4 bg-white rounded-xl">
                <QRCodeSVG value={buyLink} size={220} bgColor="#ffffff" fgColor="#000000" />
              </div>

              <div className="rounded-lg p-3 break-all font-mono text-xs"
                   style={{ background: '#161B24', border: '1px solid #1E2530', color: '#C9974D' }}>
                {buyLink}
              </div>

              <button onClick={copyLink} className="btn-primary w-full py-3">Copiar link</button>

              <p className="text-xs text-center" style={{ color: '#4B5563' }}>
                {selectedEvent?.name} · {selectedType?.name} · {qty} {qty === 1 ? 'entrada' : 'entradas'} · {METHODS.find(m => m.value === payMethod)?.label}
              </p>
            </div>
          ) : (
            <p className="text-sm text-center py-4" style={{ color: '#4B5563' }}>
              Seleccioná evento y tipo para mostrar el QR
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Cashier;
