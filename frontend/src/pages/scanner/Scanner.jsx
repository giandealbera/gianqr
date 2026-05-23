import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';

const COOLDOWN_MS = 2000;

const Scanner = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [events,       setEvents]       = useState([]);
  const [ticketTypes,  setTicketTypes]  = useState([]);
  const [eventSel,     setEventSel]     = useState(searchParams.get('event') || '');
  const [typeSel,      setTypeSel]      = useState(searchParams.get('ticket_type') || '');
  const [result,       setResult]       = useState(null);
  const [scanning,     setScanning]     = useState(false);
  const lastScan   = useRef(0);

  // cargar eventos
  useEffect(() => {
    api.get('/events').then(r => setEvents(r.data.filter(e => e.is_active)));
  }, []);

  // cargar tipos cuando cambia el evento
  useEffect(() => {
    if (!eventSel) { setTicketTypes([]); setTypeSel(''); return; }
    api.get(`/events/${eventSel}/ticket-types`).then(r => {
      setTicketTypes(r.data);
      // si el tipo guardado en URL ya no aplica, limpiar
      if (typeSel && !r.data.find(t => t.id === typeSel)) setTypeSel('');
    });
  }, [eventSel]);

  // sincronizar URL params
  useEffect(() => {
    const p = {};
    if (eventSel)  p.event       = eventSel;
    if (typeSel)   p.ticket_type = typeSel;
    setSearchParams(p, { replace: true });
  }, [eventSel, typeSel]);

  // inicializar escáner
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
      false
    );

    scanner.render(
      async (decodedText) => {
        const now = Date.now();
        if (now - lastScan.current < COOLDOWN_MS) return;
        lastScan.current = now;

        let qr_code = decodedText;
        try {
          const parsed = JSON.parse(decodedText);
          qr_code = parsed.code || decodedText;
        } catch { /* plain text */ }

        setScanning(true);
        try {
          const body = { qr_code };
          if (typeSel) body.ticket_type_id = typeSel;
          const res = await api.post('/tickets/scan', body);
          setResult({ ok: true, data: res.data });
          toast.success('Entrada válida');
        } catch (err) {
          const errData = err.response?.data;
          setResult({ ok: false, data: errData });
          toast.error(errData?.error || 'QR inválido');
        } finally {
          setScanning(false);
        }
      },
      () => {}
    );

    return () => scanner.clear().catch(() => {});
  }, [typeSel]);

  const [tokens, setTokens] = useState([]);
  const [creatingLink, setCreatingLink] = useState(false);

  const loadTokens = (evId) => {
    if (!evId) { setTokens([]); return; }
    api.get(`/scanner-tokens?event_id=${evId}`).then(r => setTokens(r.data)).catch(() => {});
  };

  useEffect(() => { loadTokens(eventSel); }, [eventSel]);

  const createPublicLink = async () => {
    if (!eventSel || !typeSel) {
      return toast.error('Elegi evento y tipo de entrada para generar el link');
    }
    setCreatingLink(true);
    try {
      const selType = ticketTypes.find(t => t.id === typeSel);
      const selEv   = events.find(e => e.id === eventSel);
      const res = await api.post('/scanner-tokens', {
        event_id: eventSel,
        ticket_type_id: typeSel,
        label: `${selEv?.name || ''} — ${selType?.name || ''}`,
      });
      const url = `${window.location.origin}/scan/${res.data.token}`;
      // El link YA esta creado en backend. El copiado al clipboard puede fallar
      // (permisos, falta de gesture, http vs https). No tiramos error global por
      // eso: refrescamos la lista y damos feedback adecuado.
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch { /* swallow: el link se ve en la lista de abajo */ }
      toast.success(copied
        ? 'Link creado y copiado'
        : 'Link creado — copialo desde la lista de abajo');
      loadTokens(eventSel);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear link');
    } finally {
      setCreatingLink(false);
    }
  };

  const copyExisting = (token) => {
    const url = `${window.location.origin}/scan/${token}`;
    navigator.clipboard.writeText(url).then(() => toast.success('Link copiado'));
  };

  const deleteToken = async (id) => {
    if (!confirm('Desactivar este link? El portero no va a poder escanear mas con el.')) return;
    try {
      await api.delete(`/scanner-tokens/${id}`);
      toast.success('Link desactivado');
      loadTokens(eventSel);
    } catch {
      toast.error('Error al desactivar');
    }
  };

  const ticket = result?.data?.ticket;
  const selectedType = ticketTypes.find(t => t.id === typeSel);

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Escanear QR</h1>

        {/* Filtros */}
        <div className="card mb-6 space-y-3">
          <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#6B7280' }}>
            Configuracion del escaner
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Evento</label>
              <select className="input" value={eventSel} onChange={e => setEventSel(e.target.value)}>
                <option value="">Todos los eventos</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tipo de entrada</label>
              <select className="input" value={typeSel} onChange={e => setTypeSel(e.target.value)} disabled={!eventSel}>
                <option value="">Todos los tipos</option>
                {ticketTypes.map(tt => (
                  <option key={tt.id} value={tt.id}>{tt.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Indicador del modo */}
          <div className="text-sm pt-1">
            {typeSel ? (
              <span className="font-medium" style={{ color: '#C9974D' }}>
                Modo: solo &ldquo;{selectedType?.name}&rdquo;
              </span>
            ) : eventSel ? (
              <span className="text-gray-400">Modo: todos los tipos del evento</span>
            ) : (
              <span className="text-gray-600">Sin filtro — acepta cualquier entrada</span>
            )}
          </div>

          {/* Generar link compartible (publico, sin login) */}
          <div className="pt-3 border-t border-gray-800 space-y-2">
            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#6B7280' }}>
              Link compartible para portero
            </p>
            <p className="text-xs" style={{ color: '#4B5563' }}>
              Genera un link publico que el portero puede abrir desde su celular sin login. Validara solo entradas del tipo seleccionado.
            </p>
            <button
              onClick={createPublicLink}
              disabled={!eventSel || !typeSel || creatingLink}
              className="btn-primary w-full text-sm py-2 disabled:opacity-30"
            >
              {creatingLink ? 'Generando...' : 'Generar y copiar link para portero'}
            </button>

            {/* Links existentes */}
            {tokens.length > 0 && (
              <div className="space-y-1.5 mt-3">
                <p className="text-xs" style={{ color: '#6B7280' }}>Links activos de este evento:</p>
                {tokens.map(tk => (
                  <div key={tk.id} className="flex items-center gap-2 rounded-lg p-2 text-xs"
                       style={{ background: '#0D1117', border: '1px solid #1E2530' }}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{tk.label || tk.ticket_type_name}</p>
                      <p className="font-mono truncate" style={{ color: '#6B7280' }}>/scan/{tk.token.substring(0, 8)}...</p>
                    </div>
                    <button onClick={() => copyExisting(tk.token)}
                            className="px-2 py-1 rounded text-xs hover:bg-gray-800"
                            style={{ color: '#C9974D' }}>
                      Copiar
                    </button>
                    <button onClick={() => deleteToken(tk.id)}
                            className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-900/20">
                      Desactivar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Scanner */}
          <div>
            <div className="card">
              <p className="text-sm text-gray-400 mb-4">Apunta la camara al QR de la entrada</p>
              <div id="qr-reader" className="rounded-lg overflow-hidden" />
              {scanning && (
                <div className="text-center mt-3 text-brand animate-pulse">Verificando...</div>
              )}
            </div>
          </div>

          {/* Result */}
          <div>
            {result ? (
              <div className={`card border-2 ${result.ok ? 'border-green-500' : 'border-red-500'}`}>
                <div className={`text-4xl font-black text-center mb-3 ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {result.ok ? 'OK' : 'NO'}
                </div>
                <h2 className={`text-lg font-bold text-center mb-4 ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {result.ok ? 'ENTRADA VÁLIDA' : 'ENTRADA INVÁLIDA'}
                </h2>

                {result.data?.error && (
                  <p className="text-center text-red-300 mb-4 text-sm">{result.data.error}</p>
                )}

                {ticket && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-400">Nombre</span>
                      <span className="font-medium">{ticket.buyer_name} {ticket.buyer_apellido}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-400">Evento</span>
                      <span>{ticket.evento}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-400">Tipo</span>
                      <span>{ticket.tipo_entrada}</span>
                    </div>
                    {ticket.scanned_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Escaneado</span>
                        <span>{new Date(ticket.scanned_at).toLocaleTimeString('es-AR')}</span>
                      </div>
                    )}
                  </div>
                )}

                <button onClick={() => setResult(null)} className="btn-secondary w-full mt-4">
                  Nuevo escaneo
                </button>
              </div>
            ) : (
              <div className="card text-center text-gray-600">
                <p className="text-4xl mb-3 font-black" style={{ color: '#1E2530' }}>QR</p>
                <p className="text-sm">El resultado aparecera aqui</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Scanner;
