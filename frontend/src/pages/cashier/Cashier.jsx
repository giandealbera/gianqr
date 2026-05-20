import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';

const HOUSE_CODE = 'CASA';
const METHODS = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
];

const Cashier = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [searchParams] = useSearchParams();
  const [events,      setEvents]      = useState([]);
  const [eventSel,    setEventSel]    = useState(searchParams.get('event') || '');
  const [ticketTypes, setTicketTypes] = useState([]);
  const [typeSel,     setTypeSel]     = useState('');
  const [qty,         setQty]         = useState(1);
  const [payMethod,   setPayMethod]   = useState('efectivo');
  const [cortesia,    setCortesia]    = useState(false);

  // Estado del link generado tras presionar "Generar link"
  const [generatedLink, setGeneratedLink] = useState('');
  const [loadingLink,   setLoadingLink]   = useState(false);

  useEffect(() => {
    api.get('/events').then(r => setEvents(r.data.filter(e => e.is_active)));
  }, []);

  useEffect(() => {
    if (!eventSel) { setTicketTypes([]); setTypeSel(''); return; }
    api.get(`/events/${eventSel}`).then(r => setTicketTypes(r.data.ticket_types || []));
  }, [eventSel]);

  // Cualquier cambio invalida el link previo: hay que apretar de nuevo.
  useEffect(() => {
    setGeneratedLink('');
  }, [eventSel, typeSel, qty, payMethod, cortesia]);

  const selectedType  = ticketTypes.find(t => t.id === typeSel);
  const selectedEvent = events.find(e => e.id === eventSel);
  const totalPrice    = cortesia ? 0 : (selectedType ? parseFloat(selectedType.price) * qty : 0);

  const generateLink = async () => {
    if (!eventSel || !typeSel) return;
    setLoadingLink(true);
    try {
      const response = await api.post('/tickets/pre-sell', {
        event_id: eventSel,
        ticket_type_id: typeSel,
        qty,
        payment_method: cortesia ? null : payMethod,
        cortesia,
      });
      const ticketIds = response.data.tickets;
      const link = `${window.location.origin}/comprar/${HOUSE_CODE}?tickets=${ticketIds.join(',')}`;
      setGeneratedLink(link);
      // Refresco el tipo para que el cupo restante se vea actualizado
      try {
        const r = await api.get(`/events/${eventSel}`);
        setTicketTypes(r.data.ticket_types || []);
      } catch { /* no-op */ }
      toast.success(cortesia ? 'Cortesía registrada' : 'Entradas registradas');
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || 'Error al generar el link');
    } finally {
      setLoadingLink(false);
    }
  };

  const copyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink).then(() => toast.success('Link copiado'));
  };

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Caja</h1>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
          Definí evento, tipo, cantidad y forma de pago. Al apretar Generar link la entrada queda registrada como vendida; mandale el link al comprador para que cargue sus datos.
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

          {/* Toggle cortesia - solo admin */}
          {isAdmin && typeSel && (
            <label className="flex items-center gap-3 rounded-lg p-3 cursor-pointer"
                   style={{ background: cortesia ? 'rgba(201,151,77,0.08)' : '#161B24',
                            border: `1px solid ${cortesia ? 'rgba(201,151,77,0.4)' : '#1E2530'}` }}>
              <input type="checkbox" className="w-4 h-4 accent-amber-600"
                     checked={cortesia}
                     onChange={e => setCortesia(e.target.checked)} />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: cortesia ? '#C9974D' : '#E8EAF0' }}>
                  Cortesía (sin costo)
                </p>
                <p className="text-xs" style={{ color: '#6B7280' }}>
                  La entrada sale $0 y queda registrada como cortesía
                </p>
              </div>
            </label>
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
              {!cortesia && (
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Forma de pago *</label>
                  <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                    {METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Total */}
          {selectedType && (
            <div className="rounded-lg p-3 flex justify-between items-center"
                 style={{ background: '#161B24', border: '1px solid #1E2530' }}>
              <span className="text-sm" style={{ color: '#6B7280' }}>
                {cortesia ? 'Total' : 'Total a cobrar'}
              </span>
              <span className="text-lg font-black" style={{ color: '#C9974D' }}>
                {cortesia ? 'CORTESÍA' : `$${totalPrice.toLocaleString('es-AR')}`}
              </span>
            </div>
          )}

          {/* Generar link / mostrar link */}
          {generatedLink ? (
            <div className="space-y-4 pt-2 border-t border-gray-800">
              <p className="text-xs uppercase tracking-widest font-semibold text-center" style={{ color: '#6B7280' }}>
                Link para el comprador — ya quedó registrada como {cortesia ? 'cortesía' : 'vendida'}
              </p>
              <p className="text-[10px] text-center -mt-2" style={{ color: '#4B5563' }}>
                (El comprador carga sus datos y verá su propio QR)
              </p>

              <div className="rounded-lg p-3 break-all font-mono text-xs"
                   style={{ background: '#161B24', border: '1px solid #1E2530', color: '#C9974D' }}>
                {generatedLink}
              </div>

              <button onClick={copyLink} className="btn-primary w-full py-3">Copiar link</button>

              <p className="text-xs text-center" style={{ color: '#4B5563' }}>
                {selectedEvent?.name} · {selectedType?.name} · {qty} {qty === 1 ? 'entrada' : 'entradas'}
                {cortesia ? ' · CORTESÍA' : ` · ${METHODS.find(m => m.value === payMethod)?.label}`}
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-2 border-t border-gray-800">
              {eventSel && typeSel ? (
                <button
                  onClick={generateLink}
                  disabled={loadingLink}
                  className="btn-primary w-full py-3 text-base font-semibold"
                >
                  {loadingLink ? 'Generando...' : 'Generar link'}
                </button>
              ) : (
                <p className="text-sm text-center py-4" style={{ color: '#4B5563' }}>
                  Elegí evento y tipo para poder generar el link
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Cashier;
