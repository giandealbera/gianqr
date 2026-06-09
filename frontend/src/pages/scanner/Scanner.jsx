import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import { useConfirm } from '../../context/ConfirmContext';
import useWakeLock from '../../hooks/useWakeLock';
import { Icon } from '../../components/Icon';
import toast from 'react-hot-toast';

const COOLDOWN_MS = 2000;

// Vibracion corta = ok, doble larga = error. Util en boliches ruidosos.
const VIBRATE_OK  = [40];
const VIBRATE_BAD = [60, 60, 120];
const buzz = (pattern) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch { /* iOS Safari no soporta */ }
  }
};

const Scanner = () => {
  useWakeLock(true); // pantalla siempre prendida en el escaner
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [events,       setEvents]       = useState([]);
  const [ticketTypes,  setTicketTypes]  = useState([]);
  const [eventSel,     setEventSel]     = useState(searchParams.get('event') || '');
  const [typeSel,      setTypeSel]      = useState(searchParams.get('ticket_type') || '');
  const [result,       setResult]       = useState(null);
  const [scanning,     setScanning]     = useState(false);
  const [camError,     setCamError]     = useState(null);
  const [needsTap,     setNeedsTap]     = useState(false);
  const lastScan = useRef(0);
  const scannerRef = useRef(null);
  // Espejo de typeSel en ref para leer el valor mas reciente dentro del
  // callback del scanner SIN remontar el componente cuando typeSel cambia.
  // Antes el useEffect dependia de [typeSel] y eso destruia/recreaba el
  // Html5QrcodeScanner cada vez que cambiabas de filtro: flicker + el
  // browser re-pedia permiso de camara en algunos casos.
  const typeSelRef = useRef(typeSel);

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

  // sincronizar URL params + sincronizar el ref de typeSel
  useEffect(() => {
    typeSelRef.current = typeSel;
    const p = {};
    if (eventSel)  p.event       = eventSel;
    if (typeSel)   p.ticket_type = typeSel;
    setSearchParams(p, { replace: true });
  }, [eventSel, typeSel]);

  // Qué hacer cuando se lee un QR. Estable: lee typeSel del ref, no de deps.
  const handleDecoded = useCallback(async (decodedText) => {
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
      const currentType = typeSelRef.current;
      if (currentType) body.ticket_type_id = currentType;
      const res = await api.post('/tickets/scan', body);
      buzz(VIBRATE_OK);
      setResult({ ok: true, data: res.data });
      toast.success('Entrada válida');
    } catch (err) {
      const errData = err.response?.data;
      buzz(VIBRATE_BAD);
      setResult({ ok: false, data: errData });
      toast.error(errData?.error || 'QR inválido');
    } finally {
      setScanning(false);
    }
  }, []);

  // Arranca la cámara trasera con la API de bajo nivel (no el widget): sin
  // botón "Request Camera Permission" en inglés ni selector. Si el navegador
  // exige un toque, dejamos needsTap=true y mostramos un botón EN ESPAÑOL.
  const startCamera = useCallback(async () => {
    const html5 = scannerRef.current;
    if (!html5) return;
    setCamError(null);
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    try {
      await html5.start({ facingMode: 'environment' }, config, handleDecoded, () => {});
      setNeedsTap(false);
    } catch {
      try {
        const cams = await Html5Qrcode.getCameras();
        if (!cams?.length) { setCamError('No se detectó ninguna cámara.'); setNeedsTap(true); return; }
        const back = cams.find(c => /back|rear|tras|environment/i.test(c.label || '')) || cams[cams.length - 1];
        await html5.start(back.id, config, handleDecoded, () => {});
        setNeedsTap(false);
      } catch {
        // El navegador suele exigir un toque del usuario, o se denegó el permiso.
        setNeedsTap(true);
      }
    }
  }, [handleDecoded]);

  // Montar el escáner UNA vez por vida del componente.
  useEffect(() => {
    const html5 = new Html5Qrcode('qr-reader', { verbose: false });
    scannerRef.current = html5;
    startCamera();
    return () => {
      scannerRef.current = null;
      html5.stop().then(() => html5.clear()).catch(() => {});
    };
  }, [startCamera]);

  const [tokens, setTokens] = useState([]);
  const [creatingLink, setCreatingLink] = useState(false);
  // Selección de tipos PARA EL LINK del portero (independiente del filtro del
  // escáner de arriba). "Todos" o un subconjunto vía checkboxes.
  const [linkAllTypes, setLinkAllTypes] = useState(true);
  const [linkTypeIds,  setLinkTypeIds]  = useState([]);

  // Al cambiar de evento, reseteo la selección del link.
  useEffect(() => { setLinkAllTypes(true); setLinkTypeIds([]); }, [eventSel]);

  const toggleLinkType = (id) => {
    setLinkTypeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const loadTokens = (evId) => {
    if (!evId) { setTokens([]); return; }
    api.get(`/scanner-tokens?event_id=${evId}`).then(r => setTokens(r.data)).catch(() => {});
  };

  useEffect(() => { loadTokens(eventSel); }, [eventSel]);

  const createPublicLink = async () => {
    if (!eventSel) return toast.error('Elegí un evento para generar el link');
    if (!linkAllTypes && linkTypeIds.length === 0)
      return toast.error('Elegí "Todos los tipos" o al menos un tipo de entrada');
    setCreatingLink(true);
    try {
      const selEv = events.find(e => e.id === eventSel);
      const names = linkAllTypes
        ? 'Todos los tipos'
        : linkTypeIds.map(id => ticketTypes.find(t => t.id === id)?.name).filter(Boolean).join(' + ');
      const res = await api.post('/scanner-tokens', {
        event_id: eventSel,
        all_types: linkAllTypes,
        ticket_type_ids: linkAllTypes ? [] : linkTypeIds,
        label: `${selEv?.name || ''} — ${names}`,
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
    const ok = await confirm({
      title: 'Desactivar link',
      message: 'El portero no va a poder escanear más con este link.',
      confirmText: 'Desactivar',
      dangerous: true,
    });
    if (!ok) return;
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
              Genera un link publico que el portero puede abrir desde su celular sin login. Elegí qué tipos de entrada valida.
            </p>

            {!eventSel ? (
              <p className="text-xs" style={{ color: '#6B7280' }}>Elegí un evento arriba para configurar el link.</p>
            ) : (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={linkAllTypes}
                    onChange={e => setLinkAllTypes(e.target.checked)}
                  />
                  <span className="font-medium">Todos los tipos del evento</span>
                </label>
                {!linkAllTypes && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-1">
                    {ticketTypes.map(tt => (
                      <label key={tt.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={linkTypeIds.includes(tt.id)}
                          onChange={() => toggleLinkType(tt.id)}
                        />
                        <span className="truncate">{tt.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={createPublicLink}
              disabled={!eventSel || creatingLink || (!linkAllTypes && linkTypeIds.length === 0)}
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
                      <p className="font-medium truncate">{tk.label || tk.type_names || tk.ticket_type_name}</p>
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
              {needsTap && (
                <button onClick={startCamera}
                  className="btn-primary w-full mt-4 text-sm py-2.5 inline-flex items-center justify-center gap-2">
                  <Icon name="camera" className="w-4 h-4" />
                  Activar cámara
                </button>
              )}
              {camError && (
                <div className="text-center mt-3 text-red-400 text-sm">{camError}</div>
              )}
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
