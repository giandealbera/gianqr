import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import api from '../../api/axios';
import Sidebar from '../../components/Sidebar';
import toast from 'react-hot-toast';

const COOLDOWN_MS = 2000;

const Scanner = () => {
  const [result, setResult]   = useState(null);  // último escaneo
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const lastScan   = useRef(0);

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
        } catch { /* texto plano */ }

        setScanning(true);
        try {
          const res = await api.post('/tickets/scan', { qr_code });
          setResult({ ok: true, data: res.data });
          toast.success('✅ Entrada válida!');
        } catch (err) {
          const errData = err.response?.data;
          setResult({ ok: false, data: errData });
          toast.error(errData?.error || 'QR inválido');
        } finally {
          setScanning(false);
        }
      },
      (error) => { /* ignorar errores de frame */ }
    );

    scannerRef.current = scanner;
    return () => scanner.clear().catch(() => {});
  }, []);

  const ticket = result?.data?.ticket;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-6">📷 Escanear QR</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Escáner */}
          <div>
            <div className="card">
              <p className="text-sm text-gray-400 mb-4">Apuntá la cámara al QR de la entrada</p>
              <div id="qr-reader" className="rounded-lg overflow-hidden" />
              {scanning && (
                <div className="text-center mt-3 text-brand animate-pulse">Verificando...</div>
              )}
            </div>
          </div>

          {/* Resultado */}
          <div>
            {result ? (
              <div className={`card border-2 ${result.ok ? 'border-green-500' : 'border-red-500'}`}>
                <div className={`text-5xl text-center mb-3 ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {result.ok ? '✅' : '❌'}
                </div>
                <h2 className={`text-xl font-bold text-center mb-4 ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {result.ok ? 'ENTRADA VÁLIDA' : 'ENTRADA INVÁLIDA'}
                </h2>

                {result.data?.error && (
                  <p className="text-center text-red-300 mb-4">{result.data.error}</p>
                )}

                {ticket && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-400">Nombre</span>
                      <span className="font-medium">{ticket.buyer_name}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-400">Evento</span>
                      <span>{ticket.evento}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-400">Tipo</span>
                      <span>{ticket.tipo_entrada}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-800 pb-2">
                      <span className="text-gray-400">DNI</span>
                      <span>{ticket.buyer_dni || '—'}</span>
                    </div>
                    {ticket.scanned_at && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Escaneado</span>
                        <span>{new Date(ticket.scanned_at).toLocaleTimeString('es-AR')}</span>
                      </div>
                    )}
                  </div>
                )}

                <button onClick={() => setResult(null)}
                  className="btn-secondary w-full mt-4">
                  Nuevo escaneo
                </button>
              </div>
            ) : (
              <div className="card text-center text-gray-500">
                <p className="text-4xl mb-3">📱</p>
                <p>El resultado del escaneo aparecerá aquí</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Scanner;
