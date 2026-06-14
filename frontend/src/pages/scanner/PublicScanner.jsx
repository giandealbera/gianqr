import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import useWakeLock from '../../hooks/useWakeLock';

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
// Cooldown bajado de 2500ms a 1200ms: con 2.5s entre scans, escanear una
// fila larga (300 personas en la puerta) se sentia lento. 1.2s sigue
// alcanzando para que no se re-dispare por accidente el mismo QR.
const COOLDOWN_MS = 1200;

// Patron de vibracion: corto = ok, doble largo = error. Sirve en la boca de
// un boliche ruidoso donde el portero no escucha bien el toast.
const VIBRATE_OK  = [40];
const VIBRATE_BAD = [60, 60, 120];
const buzz = (pattern) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch { /* iOS Safari no soporta vibrate */ }
  }
};

const PublicScanner = () => {
  const { token } = useParams();
  // Mantiene la pantalla del portero prendida mientras el componente esta
  // montado. Sin esto se bloquea el celu cada 30s y se pierde el flow.
  useWakeLock(true);
  const [info,     setInfo]     = useState(null);
  const [error,    setError]    = useState(null);
  const [result,   setResult]   = useState(null);
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState(null);
  const [needsTap, setNeedsTap] = useState(false);
  const lastScan   = useRef(0);
  const scannerRef = useRef(null);

  // Cargar info del escáner (evento y tipo de entrada)
  useEffect(() => {
    fetch(`${BACKEND}/scan/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setInfo(data);
      })
      .catch(() => setError('No se pudo conectar al servidor'));
  }, [token]);

  // Qué hacer cuando se lee un QR. Estable (solo depende del token).
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
    setResult(null);
    try {
      const res = await fetch(`${BACKEND}/scan/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code }),
      });
      const data = await res.json();
      const ok = res.ok && data.valid;
      buzz(ok ? VIBRATE_OK : VIBRATE_BAD);
      setResult({ ok, data });
    } catch {
      buzz(VIBRATE_BAD);
      setResult({ ok: false, data: { error: 'Error de conexión' } });
    } finally {
      setScanning(false);
      // Auto-reset después de 4 segundos para el siguiente escaneo
      // Auto-reset bajado de 4s a 2s: el portero ve el resultado, asiente,
      // necesita la camara lista para el proximo. 4s era una eternidad
      // cuando habia fila.
      setTimeout(() => setResult(null), 2000);
    }
  }, [token]);

  // Arranca la cámara. Siempre destruye la instancia anterior y crea una nueva
  // para evitar que un estado interno roto (ej: start() falló en el primer
  // intento sin gesto del usuario en iOS) impida futuros intentos.
  const startCamera = useCallback(async () => {
    setCamError(null);
    if (scannerRef.current) {
      const old = scannerRef.current;
      scannerRef.current = null;
      try { await old.stop(); } catch {}
      try { old.clear(); } catch {}
    }
    const html5 = new Html5Qrcode('qr-reader', { verbose: false });
    scannerRef.current = html5;
    const config = {
      fps: 30,
      qrbox: { width: 260, height: 260 },
      disableFlip: true,
      useBarCodeDetectorIfSupported: true,
    };
    // En iOS Safari, agregar width/height a facingMode hace que la cámara
    // arranque pero muestre negro. Primer intento sin resolución fija.
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
        setNeedsTap(true);
      }
    }
  }, [handleDecoded]);

  // Montar/desmontar el escáner cuando ya tenemos la info del evento.
  useEffect(() => {
    if (!info) return;
    startCamera();
    return () => {
      const html5 = scannerRef.current;
      if (!html5) return;
      scannerRef.current = null;
      html5.stop().then(() => html5.clear()).catch(() => {});
    };
  // startCamera es estable (deps: [handleDecoded] con []), solo queremos
  // montar una vez cuando info carga.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info]);

  const fmt = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : '';
  const ticket = result?.data?.ticket;

  if (error) return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
             style={{ background: 'rgba(185,28,28,0.10)', border: '1px solid rgba(185,28,28,0.35)', color: '#FCA5A5' }}>
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-red-400 text-base font-semibold">{error}</p>
        <p className="text-gray-500 mt-1.5 text-sm">Este link es inválido o fue desactivado</p>
      </div>
    </div>
  );

  if (!info) return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand" />
    </div>
  );

  return (
    <div className="min-h-dvh bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4 text-center">
        <p className="text-xl font-black tracking-tight mb-2" style={{ color: '#C9974D' }}>GianQR</p>
        <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">{info.event_name}</p>
        <h1 className="text-xl font-bold text-brand">
          {info.label || info.ticket_type_name}
        </h1>
        {info.event_date && (
          <p className="text-xs text-gray-500 mt-0.5">{fmt(info.event_date)}</p>
        )}
      </div>

      <div className="px-4 py-6 max-w-md mx-auto">
        {/* Resultado del escaneo */}
        {result && (
          <div className={`rounded-2xl border-2 p-6 mb-6 text-center transition-all ${
            result.ok ? 'border-green-500 bg-green-900/20' : 'border-red-500 bg-red-900/20'
          }`}>
            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-3 ${result.ok ? 'bg-green-900/30 border border-green-700/50' : 'bg-red-900/30 border border-red-700/50'}`}>
              <svg className={`w-9 h-9 ${result.ok ? 'text-green-400' : 'text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                {result.ok
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />}
              </svg>
            </div>
            <h2 className={`text-2xl font-black mb-2 ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
              {result.ok ? 'VÁLIDA' : 'INVÁLIDA'}
            </h2>
            {result.data?.error && (
              <p className="text-red-300 text-sm mb-3">{result.data.error}</p>
            )}
            {ticket && (
              <div className="mt-3 space-y-1.5 text-sm text-left bg-gray-900/50 rounded-xl p-4">
                <p><span className="text-gray-400">Nombre:</span> <strong>{ticket.buyer_name} {ticket.buyer_apellido || ''}</strong></p>
                <p><span className="text-gray-400">Tipo:</span> {ticket.tipo_entrada}</p>
                {result.ok && <p className="text-green-400 text-xs mt-2">Entrada marcada como utilizada</p>}
                {!result.ok && ticket.status === 'usado' && ticket.scanned_at && (
                  <p className="text-red-300 text-xs mt-2">
                    Escaneada el {new Date(ticket.scanned_at).toLocaleString('es-AR')}
                  </p>
                )}
              </div>
            )}
            <button onClick={() => setResult(null)}
              className="mt-4 w-full py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm font-medium transition-colors">
              Siguiente escaneo
            </button>
          </div>
        )}

        {/* Cámara: SIEMPRE montada (aunque haya un resultado encima) para no
            cortar el stream — si se desmonta, html5-qrcode pierde el video y
            re-pide permiso. La ocultamos con display mientras se ve el cartel. */}
        <div className="card mb-4" style={{ display: result ? 'none' : 'block' }}>
          <p className="text-sm text-gray-400 text-center mb-4">Apuntá la cámara al QR de la entrada</p>
          <div id="qr-reader" className="rounded-xl overflow-hidden" />
          {needsTap && (
            <button onClick={startCamera}
              className="mt-4 w-full py-3 rounded-xl bg-brand text-black font-semibold text-sm inline-flex items-center justify-center gap-2">
              {/* SVG inline para no agregar import a este chunk publico. */}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9zM12 17a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
              Activar cámara
            </button>
          )}
          {camError && (
            <p className="text-center text-red-400 text-sm mt-3">{camError}</p>
          )}
          {scanning && (
            <p className="text-center text-brand text-sm mt-3 animate-pulse">Verificando...</p>
          )}
        </div>

        <p className="text-center text-xs text-gray-600">
          Solo para <strong className="text-gray-500">{info.ticket_type_name}</strong> · {info.event_name}
        </p>
      </div>
    </div>
  );
};

export default PublicScanner;
