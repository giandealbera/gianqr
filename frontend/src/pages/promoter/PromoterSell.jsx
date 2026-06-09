import { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import { share } from '../../lib/share';
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
  const [loadingLink,   setLoadingLink]   = useState(false);
  // Ref al card del link para auto-scrollear apenas aparece (en mobile el
  // boton "Generar QR" y el form quedan arriba; al generar, el card del
  // link aparece debajo y se perdia de vista).
  const linkCardRef = useRef(null);

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

  // Cuando aparece un link recien generado, scrolleamos suave hacia el card.
  // En mobile el form puede ser largo y el link aparecia "abajo" sin que el
  // vendedor lo viera.
  useEffect(() => {
    if (generatedLink && linkCardRef.current) {
      requestAnimationFrame(() => {
        linkCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [generatedLink]);

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

  const generateLink = async () => {
    if (!promoCode || !eventSel || !typeSel) return;
    if (!saleWindowStatus.open) {
      toast.error(saleWindowStatus.reason || 'Ventas cerradas');
      return;
    }
    setLoadingLink(true);
    try {
      // Reservamos las entradas YA (descuenta cupo en este momento). El
      // comprador despues solo carga sus datos sobre las reservadas vía
      // ?tickets=, igual que el flujo de caja.
      const response = await api.post('/tickets/pre-sell', {
        event_id: eventSel,
        ticket_type_id: typeSel,
        qty,
        payment_method: payMethod,
      });
      const ticketIds = response.data.tickets;
      const link = `${window.location.origin}/comprar/${promoCode}?tickets=${ticketIds.join(',')}`;
      setGeneratedLink(link);
      // Refresco el tipo para que el "agotado" se vea actualizado.
      try {
        const r = await api.get(`/events/${eventSel}`);
        setTicketTypes(r.data.ticket_types || []);
      } catch { /* no-op */ }
      toast.success('Entradas reservadas');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al generar el link');
    } finally {
      setLoadingLink(false);
    }
  };

  // En iOS abre el sheet nativo (WhatsApp, Mensajes, Mail, AirDrop). En el
  // resto cae al clipboard. Una sola UX para el vendedor — no tiene que
  // pensar "¿copio o comparto?".
  const shareLink = () => {
    if (!generatedLink) return;
    share({
      title: 'Tu entrada',
      text: `Cargá tus datos para recibir tu QR:`,
      url: generatedLink,
    });
  };

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-xl font-semibold tracking-tight mb-1">Vender entrada</h1>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
          Definí evento, tipo, cantidad y forma de pago. Al generar el QR la entrada queda reservada (descuenta cupo); compartí el link con el comprador para que cargue sus datos y reciba su QR.
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
            <div ref={linkCardRef} className="space-y-4 pt-2 border-t border-gray-800">
              <p className="text-xs uppercase tracking-widest font-semibold text-center" style={{ color: '#6B7280' }}>
                Link para el comprador — ya quedó reservada
              </p>
              <p className="text-[10px] text-center -mt-2" style={{ color: '#4B5563' }}>
                (El comprador carga sus datos y recibe su propio QR)
              </p>

              <div className="rounded-lg p-3 break-all font-mono text-xs selectable"
                   style={{ background: '#161B24', border: '1px solid #1E2530', color: '#C9974D' }}>
                {generatedLink}
              </div>

              <button onClick={shareLink} className="btn-primary w-full py-3 inline-flex items-center justify-center gap-2">
                {/* SVG share inline para no agregar import. Icono "compartir"
                    estilo iOS (caja con flecha hacia arriba). */}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0L8 8m4-4l4 4" />
                </svg>
                Compartir link
              </button>

              <button onClick={() => setGeneratedLink('')} className="btn-secondary w-full py-2.5">
                + Generar otro link
              </button>

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
                    disabled={loadingLink || !saleWindowStatus.open}
                    className="btn-primary w-full py-3 text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loadingLink ? 'Generando...' : 'Generar QR'}
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
