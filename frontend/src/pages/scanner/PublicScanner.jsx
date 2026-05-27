import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const COOLDOWN_MS = 2500;

const PublicScanner = () => {
  const { token } = useParams();
  const [info,     setInfo]     = useState(null);
  const [error,    setError]    = useState(null);
  const [result,   setResult]   = useState(null);
  const [scanning, setScanning] = useState(false);
  const lastScan   = useRef(0);

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

  // Iniciar scanner de QR
  useEffect(() => {
    if (!info) return;

    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 260, height: 260 }, rememberLastUsedCamera: true },
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
        setResult(null);
        try {
          const res = await fetch(`${BACKEND}/scan/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qr_code }),
          });
          const data = await res.json();
          setResult({ ok: res.ok && data.valid, data });
        } catch {
          setResult({ ok: false, data: { error: 'Error de conexión' } });
        } finally {
          setScanning(false);
          // Auto-reset después de 4 segundos para el siguiente escaneo
          setTimeout(() => setResult(null), 4000);
        }
      },
      () => {}
    );

    return () => scanner.clear().catch(() => {});
  }, [info, token]);

  const fmt = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }) : '';
  const ticket = result?.data?.ticket;

  if (error) return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="text-red-400 text-lg font-semibold">{error}</p>
        <p className="text-gray-500 mt-2 text-sm">Este link es inválido o fue desactivado</p>
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
        {result ? (
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
        ) : (
          <div className="card mb-4">
            <p className="text-sm text-gray-400 text-center mb-4">Apuntá la cámara al QR de la entrada</p>
            <div id="qr-reader" className="rounded-xl overflow-hidden" />
            {scanning && (
              <p className="text-center text-brand text-sm mt-3 animate-pulse">Verificando...</p>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-600">
          Solo para <strong className="text-gray-500">{info.ticket_type_name}</strong> · {info.event_name}
        </p>
      </div>
    </div>
  );
};

export default PublicScanner;
