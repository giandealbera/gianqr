import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { startQrCamera, destroyQrScanner, pauseScanner, resumeScanner } from '../../lib/qrCamera';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import { useConfirm } from '../../context/ConfirmContext';
import useWakeLock from '../../hooks/useWakeLock';
import { Icon } from '../../components/Icon';
import { share } from '../../lib/share';
import toast from 'react-hot-toast';

// Cuanto ignoramos el MISMO QR despues de procesarlo. Evita releer el
// celular del cliente que todavia esta en el cuadro.
const REPEAT_LOCK_MS = 8000;

// Con una entrada VALIDA seguimos escaneando solos, sin que el portero
// toque nada. Las invalidas quedan fijas hasta que las despache a mano.
const AUTO_NEXT_MS = 1400;

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
  const scannerRef = useRef(null);
  // Guarda de reentrada: a 30 FPS el callback se dispara muchas veces
  // mientras el servidor todavia esta respondiendo.
  const busyRef = useRef(false);
  // Marca si el componente sigue montado. Sin esto, un arranque que termina
  // DESPUES de desmontar deja una camara prendida sin dueño.
  const montadoRef = useRef(true);
  // Candado de arranque: evita dos aperturas de camara simultaneas.
  const arrancandoRef = useRef(false);
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

  const lastScannedCode = useRef('');
  const lastScannedTime = useRef(0);

  // Qué hacer cuando se lee un QR. Estable: lee typeSel del ref, no de deps.
  const handleDecoded = useCallback(async (decodedText) => {
    // Sin esta guarda salian varios POST en paralelo y un resultado pisaba
    // al otro.
    if (busyRef.current) return;

    let qr_code = decodedText;
    try {
      const parsed = JSON.parse(decodedText);
      qr_code = parsed.code || decodedText;
    } catch { /* plain text */ }

    const cleanCode = String(qr_code || '').toUpperCase().trim();
    if (!cleanCode) return;
    const now = Date.now();

    // Mismo QR recien procesado: ignorar en silencio.
    if (cleanCode === lastScannedCode.current && (now - lastScannedTime.current < REPEAT_LOCK_MS)) {
      return;
    }

    busyRef.current = true;
    lastScannedCode.current = cleanCode;
    lastScannedTime.current = now;
    // Dejamos de decodificar mientras verificamos contra el servidor.
    pauseScanner(scannerRef.current);

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
      // Si no hubo respuesta del servidor fue la RED, no el QR: liberamos el
      // bloqueo para poder reintentar la misma entrada en el acto.
      if (!err.response) lastScannedCode.current = '';
      buzz(VIBRATE_BAD);
      setResult({ ok: false, data: errData });
      toast.error(errData?.error || 'QR inválido');
    } finally {
      setScanning(false);
      busyRef.current = false;
    }
  }, []);

  // Auto-continuar tras una entrada valida: el cartel se limpia solo y la
  // fila sigue. Las invalidas quedan hasta que el portero las despache.
  useEffect(() => {
    if (!result?.ok) return;
    const t = setTimeout(() => setResult(null), AUTO_NEXT_MS);
    return () => clearTimeout(t);
  }, [result]);

  // Sin cartel en pantalla, volvemos a decodificar.
  useEffect(() => {
    if (result) return;
    resumeScanner(scannerRef.current);
  }, [result]);

  // Arranca la cámara trasera con la API de bajo nivel (no el widget): sin
  // botón "Request Camera Permission" en inglés ni selector. Si el navegador
  // exige un toque, dejamos needsTap=true y mostramos un botón EN ESPAÑOL.
  const startCamera = useCallback(async () => {
    // Candado: si ya hay un arranque en curso, no largamos otro. Sin esto, el
    // arranque automatico y un toque en "Activar camara" corrian a la vez,
    // creaban DOS instancias y quedaban dos camaras prendidas con dos
    // previews apilados.
    if (arrancandoRef.current) return;
    arrancandoRef.current = true;
    setCamError(null);
    try {
      // Descartamos la instancia previa antes de reintentar: una instancia con
      // un start() fallido queda trabada y contagia el error a todo lo demas.
      const previa = scannerRef.current;
      scannerRef.current = null;
      await destroyQrScanner(previa);

      const { ok, error, scanner } = await startQrCamera({
        elementId: 'qr-reader',
        onDecoded: handleDecoded,
      });

      if (!montadoRef.current) { await destroyQrScanner(scanner); return; }
      scannerRef.current = scanner || null;
      setNeedsTap(!ok);
      setCamError(ok ? null : error);
    } finally {
      arrancandoRef.current = false;
    }
  }, [handleDecoded]);

  // Montar el escáner UNA vez por vida del componente.
  useEffect(() => {
    montadoRef.current = true;
    startCamera();
    return () => {
      montadoRef.current = false;
      const s = scannerRef.current;
      scannerRef.current = null;
      destroyQrScanner(s);
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

  const shareToken = (token) => {
    const url = `${window.location.origin}/scan/${token}`;
    share({ title: 'Link de escáner', text: 'Acceso al escáner de entradas:', url });
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
        <h1 className="text-xl font-semibold tracking-tight mb-6">Escanear QR</h1>

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
                    <button onClick={() => shareToken(tk.token)}
                            className="px-2 py-1 rounded text-xs hover:bg-gray-800"
                            style={{ color: '#C9974D' }}>
                      Compartir
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
                {result.ok ? (
                  <div className="text-center my-3 space-y-2">
                    <h2 className="text-3xl font-black text-green-400">VÁLIDA</h2>
                    {ticket && (
                      <p className="text-xl font-bold text-white">
                        {ticket.buyer_name} {ticket.buyer_apellido || ''}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center my-3 space-y-2">
                    <h2 className="text-xl font-bold text-red-400">ENTRADA INVÁLIDA</h2>
                    {result.data?.error && (
                      <p className="text-red-300 text-sm font-medium">{result.data.error}</p>
                    )}
                    {ticket && ticket.status === 'usado' && ticket.scanned_at && (
                      <p className="text-xs text-gray-400">
                        Escaneada previamente el {new Date(ticket.scanned_at).toLocaleString('es-AR')}
                      </p>
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
