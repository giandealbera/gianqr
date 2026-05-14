import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';

const METHODS = [
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
];

const Cashier = () => {
  const [searchParams] = useSearchParams();
  const preselectedEvent = searchParams.get('event');
  
  const [events,     setEvents]     = useState([]);
  const [eventSel,   setEventSel]   = useState(preselectedEvent || '');
  const [ticketTypes, setTicketTypes] = useState([]);
  const [form, setForm] = useState({
    ticket_type_id: '', buyer_name: '', buyer_apellido: '', buyer_celular: '',
    buyer_dni: '', buyer_email: '', payment_method: 'efectivo', payment_ref: '',
    promotor_code: '',
  });
  const [saving,  setSaving]  = useState(false);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    api.get('/events').then(r =>
      setEvents(r.data.filter(e => e.is_active))
    );
  }, []);

  useEffect(() => {
    if (!eventSel) { setTicketTypes([]); return; }
    api.get(`/events/${eventSel}`).then(r => setTicketTypes(r.data.ticket_types || []));
  }, [eventSel]);

  const selectedType = ticketTypes.find(t => t.id === form.ticket_type_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!eventSel) return toast.error('Seleccioná un evento');
    setSaving(true);
    try {
      const res = await api.post('/tickets', { ...form, event_id: eventSel });
      setCreated(res.data);
      toast.success('Entrada vendida!');
      setForm({ ticket_type_id: '', buyer_name: '', buyer_apellido: '', buyer_celular: '',
        buyer_dni: '', buyer_email: '', payment_method: 'efectivo', payment_ref: '', promotor_code: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear ticket');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Vender Entrada</h1>

        {created ? (
          <div className="card text-center space-y-4">
            <div className="text-green-400 text-5xl">✓</div>
            <h2 className="text-xl font-bold">Entrada vendida</h2>
            <p className="text-gray-400">{created.buyer_name} — {created.buyer_email}</p>
            <div className="flex justify-center">
              <QRCodeSVG
                value={JSON.stringify({ code: created.qr_code, ticket_id: created.id })}
                size={200}
                bgColor="transparent"
                fgColor="#ffffff"
              />
            </div>
            <p className="font-mono text-sm text-gray-400">{created.qr_code}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setCreated(null)} className="btn-primary">
                Nueva venta
              </button>
              <button onClick={() => window.print()} className="btn-secondary">
                Imprimir QR
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-5">
            {/* Evento */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Evento *</label>
              <select className="input" required value={eventSel}
                onChange={e => { setEventSel(e.target.value); setForm(f => ({ ...f, ticket_type_id: '' })); }}>
                <option value="">Seleccioná un evento</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} — {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR')} {ev.venue_name ? `(${ev.venue_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de entrada */}
            {ticketTypes.length > 0 && (
              <div>
                <label className="text-sm text-gray-400 block mb-1">Tipo de entrada *</label>
                <select className="input" required value={form.ticket_type_id}
                  onChange={e => setForm(f => ({ ...f, ticket_type_id: e.target.value }))}>
                  <option value="">Seleccioná tipo</option>
                  {ticketTypes.map(tt => (
                    <option key={tt.id} value={tt.id} disabled={tt.available <= 0}>
                      {tt.name} — ${parseFloat(tt.price).toLocaleString('es-AR')}
                      {' '}({tt.available} disponibles)
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

            {/* Datos del comprador */}
            <div className="space-y-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Datos del comprador</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Nombre *</label>
                  <input className="input" required placeholder="Juan" value={form.buyer_name}
                    onChange={e => setForm(f => ({ ...f, buyer_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Apellido</label>
                  <input className="input" placeholder="García" value={form.buyer_apellido}
                    onChange={e => setForm(f => ({ ...f, buyer_apellido: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-400 block mb-1">DNI</label>
                  <input className="input" placeholder="12345678" inputMode="numeric"
                    value={form.buyer_dni}
                    onChange={e => setForm(f => ({ ...f, buyer_dni: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Celular</label>
                  <input className="input" placeholder="2645 123456" inputMode="tel"
                    value={form.buyer_celular}
                    onChange={e => setForm(f => ({ ...f, buyer_celular: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Email <span className="text-gray-600">(opcional)</span></label>
                <input type="email" className="input" placeholder="juan@email.com"
                  value={form.buyer_email}
                  onChange={e => setForm(f => ({ ...f, buyer_email: e.target.value }))} />
              </div>
            </div>

            {/* Método de pago */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Método de pago *</label>
              <div className="flex gap-2 flex-wrap">
                {METHODS.map(m => (
                  <button type="button" key={m.value}
                    onClick={() => setForm(f => ({ ...f, payment_method: m.value }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      form.payment_method === m.value
                        ? 'bg-brand border-brand text-white'
                        : 'border-gray-700 text-gray-400 hover:border-gray-500'
                    }`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Referencia de pago */}
            {form.payment_method === 'transferencia' && (
              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  Nro. de transferencia
                </label>
                <input className="input" value={form.payment_ref}
                  onChange={e => setForm(f => ({ ...f, payment_ref: e.target.value }))} />
              </div>
            )}

            {/* Código de promotor */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">Código de promotor (opcional)</label>
              <input className="input" placeholder="ej: PROMO2024" value={form.promotor_code}
                onChange={e => setForm(f => ({ ...f, promotor_code: e.target.value.toUpperCase() }))} />
            </div>

            <button type="submit" disabled={saving || !form.ticket_type_id} className="btn-primary w-full text-lg py-3">
              {saving ? 'Procesando...' : 'Vender entrada'}
            </button>
          </form>
        )}
      </div>
    </Layout>
  );
};

export default Cashier;
