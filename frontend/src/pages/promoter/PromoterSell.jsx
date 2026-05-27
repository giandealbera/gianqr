import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';

const METHODS = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
];

const PromoterSell = () => {
  const [promoCode,    setPromoCode]    = useState('');
  const [events,       setEvents]       = useState([]);
  const [ticketTypes,  setTicketTypes]  = useState([]);
  const [eventSel,     setEventSel]     = useState('');
  const [typeSel,      setTypeSel]      = useState('');
  const [qty,          setQty]          = useState(1);
  const [payMethod,    setPayMethod]    = useState('efectivo');

  // Link generado tras apretar "Generar QR". El vendedor no ve el QR
  // (eso lo ve el comprador al cargar sus datos). Solo copia y comparte el link.
  const [generatedLink, setGeneratedLink] = useState('');

  useEffect(() => {
    api.get('/events').then(r => setEvents(r.data.filter(e => e.is_active)));
    api.get('/users/my-sales').then(r => setPromoCode(r.data.promo_code)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!eventSel) { setTicketTypes([]); setTypeSel(''); return; }
    api.get(`/events/${eventSel}`)
      .then(r => setTicketTypes(r.data.ticket_types || []))
      .catch(err => toast.error(err.response?.data?.error || 'No se pudo cargar el evento'));
  }, [eventSel]);

  // Cualquier cambio en el form invalida el link previo: hay que apretar de nuevo.
  useEffect(() => {
    setGeneratedLink('');
  }, [eventSel, typeSel, qty, payMethod]);

  const selectedType  = ticketTypes.find(t => t.id === typeSel);
  const selectedEvent = events.find(e => e.id === eventSel);
  const totalPrice    = selectedType ? parseFloat(selectedType.price) * qty : 0;

  // Ventana de venta del evento. Si esta cerrada (no abrio aun, ya cerro,
  // sold out manual o evento inactivo) bloqueamos el boton para que el
  // vendedor no genere un link que despues va a fallar.
  const saleWindowStatus = (() => {
    if (!selectedEvent) return { open: true };
    const now = new Date();
    if (selectedEvent.sale_start_at) {
      const start = new Date(selectedEvent.sale_start_at);
      if (now < start) return { open: false, reason: `Las ventas abren el ${start.toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}` };
    }
    if (selectedEvent.sale_end_at) {
      const end = new Date(selectedEvent.sale_end_at);
      if (now > end) return { open: false, reason: `Ventas cerradas el ${end.toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}` };
    }
    if (selectedEvent.sales_stopped_at) return { open: false, reason: 'Venta cortada manualmente (SOLD OUT)' };
    if (selectedEvent.is_active === 0) return { open: false, reason: 'El evento está inactivo' };
    return { open: true };
  })();

  const generateLink = () => {
    if (!promoCode || !eventSel || !typeSel) return;
    if (!saleWindowStatus.open) {
      toast.error(saleWindowStatus.reason || 'Ventas cerradas');
      return;
    }
    const link = `${window.location.origin}/comprar/${promoCode}?event=${eventSel}&type=${typeSel}&qty=${qty}&pay=${payMethod}`;
    setGeneratedLink(link);
    toast.success('Link generado');
  };

  const copyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink).then(() => toast.success('Link copiado'));
  };

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Vender entrada</h1>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
          Definí evento, tipo, cantidad y forma de pago. Generá el link y compartilo con el comprador para que cargue sus datos y reciba su QR.
        </p>

        <div className="card space-y-5">
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

          {ticketTypes.length > 0 && (
            <div>
              <label className="text-sm text-gray-400 block mb-1">Tipo de entrada *</label>
              <select className="input" value={typeSel} onChange={e => setTypeSel(e.target.value)}>
                <option value="">Seleccionar tipo</option>
                {ticketTypes.map(tt => (
                  <option key={tt.id} value={tt.id} disabled={tt.available <= 0}>
                    {/* No exponemos el numero exacto de cupo disponible al vendedor,
                        solo "agotado". El dueño es el unico que ve los counters. */}
                    {tt.name} — ${parseFloat(tt.price).toLocaleString('es-AR')}{tt.available <= 0 ? ' (agotado)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

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

          {selectedType && (
            <div className="rounded-lg p-3 flex justify-between items-center"
                 style={{ background: '#161B24', border: '1px solid #1E2530' }}>
              <span className="text-sm" style={{ color: '#6B7280' }}>Total a cobrar</span>
              <span className="text-lg font-black" style={{ color: '#C9974D' }}>
                ${totalPrice.toLocaleString('es-AR')}
              </span>
            </div>
          )}

          {generatedLink ? (
            <div className="space-y-4 pt-2 border-t border-gray-800">
              <p className="text-xs uppercase tracking-widest font-semibold text-center" style={{ color: '#6B7280' }}>
                Link para el comprador — compartilo para que cargue sus datos
              </p>
              <p className="text-[10px] text-center -mt-2" style={{ color: '#4B5563' }}>
                (El comprador carga sus datos y recibe su propio QR)
              </p>

              <div className="rounded-lg p-3 break-all font-mono text-xs"
                   style={{ background: '#161B24', border: '1px solid #1E2530', color: '#C9974D' }}>
                {generatedLink}
              </div>

              <button onClick={copyLink} className="btn-primary w-full py-3">Copiar link</button>

              <p className="text-xs text-center" style={{ color: '#4B5563' }}>
                {selectedEvent?.name} · {selectedType?.name} · {qty} {qty === 1 ? 'entrada' : 'entradas'} · {METHODS.find(m => m.value === payMethod)?.label}
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-2 border-t border-gray-800">
              {!promoCode ? (
                <p className="text-sm text-center py-4" style={{ color: '#4B5563' }}>
                  No tenes codigo de publica asignado
                </p>
              ) : eventSel && typeSel ? (
                <>
                  {!saleWindowStatus.open && (
                    <div className="rounded-lg p-3 text-sm"
                         style={{ background: 'rgba(185,28,28,0.10)', border: '1px solid rgba(185,28,28,0.35)', color: '#FCA5A5' }}>
                      {saleWindowStatus.reason}
                    </div>
                  )}
                  <button
                    onClick={generateLink}
                    disabled={!saleWindowStatus.open}
                    className="btn-primary w-full py-3 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Generar QR
                  </button>
                </>
              ) : (
                <p className="text-sm text-center py-4" style={{ color: '#4B5563' }}>
                  Elegi evento y tipo para generar el QR
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default PromoterSell;
