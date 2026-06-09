// Setup de 2FA / TOTP.
//
// Flujo de pantalla:
//   - Si todavia no esta habilitado: mostrar QR + secret + input para
//     confirmar el primer codigo. Al confirmar, mostramos los 10 recovery
//     codes UNA sola vez (boton para copiarlos).
//   - Si ya esta habilitado: mostrar el estado + botones "Desactivar 2FA"
//     y "Regenerar códigos de recuperación", cada uno pide password + token.

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const TwoFactorSetup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { logout, refreshUser } = useAuth();
  // Modo "obligatorio": llegamos aca porque el rol exige 2FA y todavia
  // no lo activamos. En este modo no hay "Volver" — solo se sale activando
  // 2FA (lo cual apaga tfa_required) o haciendo logout.
  const required = searchParams.get('required') === '1';
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);

  // Estado del setup (cuando enabled=false)
  const [setupData, setSetupData] = useState(null); // { secret, otpauth_uri, qr_data_url }
  const [confirmToken, setConfirmToken] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState(null); // se muestra UNA vez

  // Estado de disable / regenerate (cuando enabled=true)
  const [actionMode, setActionMode] = useState(null); // 'disable' | 'regenerate' | null
  const [actionForm, setActionForm] = useState({ password: '', token: '' });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/2fa/status')
      .then(r => setEnabled(!!r.data.enabled))
      .finally(() => setLoading(false));
  }, []);

  const startSetup = async () => {
    setLoading(true);
    try {
      const r = await api.get('/auth/2fa/setup');
      setSetupData(r.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error iniciando 2FA');
    } finally {
      setLoading(false);
    }
  };

  const confirmEnable = async (e) => {
    e.preventDefault();
    setConfirming(true);
    try {
      const r = await api.post('/auth/2fa/enable', { token: confirmToken });
      setRecoveryCodes(r.data.recovery_codes);
      setEnabled(true);
      // Refresh user para limpiar tfa_required del context, asi
      // ProtectedRoute deja de redirigir.
      if (refreshUser) await refreshUser();
      toast.success('2FA habilitado');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Código incorrecto');
    } finally {
      setConfirming(false);
    }
  };

  const runAction = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      if (actionMode === 'disable') {
        await api.post('/auth/2fa/disable', actionForm);
        toast.success('2FA desactivado');
        setEnabled(false);
        setActionMode(null);
        setActionForm({ password: '', token: '' });
      } else if (actionMode === 'regenerate') {
        const r = await api.post('/auth/2fa/recovery/regenerate', actionForm);
        setRecoveryCodes(r.data.recovery_codes);
        setActionMode(null);
        setActionForm({ password: '', token: '' });
        toast.success('Códigos regenerados');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    } finally {
      setActionLoading(false);
    }
  };

  const copyAllCodes = () => {
    if (!recoveryCodes) return;
    navigator.clipboard.writeText(recoveryCodes.join('\n'))
      .then(() => toast.success('Códigos copiados'))
      .catch(() => toast.error('No se pudo copiar'));
  };

  if (loading) return (
    <Layout>
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-xl mx-auto">
        <h1 className="text-xl font-semibold tracking-tight mb-1">Verificación en dos pasos</h1>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
          Sumá una segunda capa al login. Cada vez que entres, además de la contraseña vamos a pedirte un código de 6 dígitos que genera tu app de autenticación (Google Authenticator, 1Password, Authy, etc.).
        </p>

        {/* Banner cuando el 2FA es obligatorio por rol y aun no esta activado */}
        {required && !enabled && (
          <div className="card mb-4"
               style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.4)' }}>
            <p className="text-sm font-semibold inline-flex items-center gap-2" style={{ color: '#FCA5A5' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Tu rol requiere 2FA
            </p>
            <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
              Por tener acceso administrativo, tenés que activar la verificación en dos pasos antes de seguir usando el sistema. Si no podés ahora, podés cerrar sesión.
            </p>
          </div>
        )}

        {/* Codigos de recuperacion recien generados */}
        {recoveryCodes && (
          <div className="card mb-6" style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.35)' }}>
            <p className="text-sm font-semibold" style={{ color: '#FBBF24' }}>Guardá estos códigos de recuperación</p>
            <p className="text-xs mt-1 mb-3" style={{ color: '#9CA3AF' }}>
              Si perdés el dispositivo, podés usar uno de estos códigos (UNA sola vez cada uno) para entrar y desactivar el 2FA. <b>No los vas a volver a ver</b> — copialos o anotalos ahora.
            </p>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
              {recoveryCodes.map((c, i) => (
                <div key={i} className="px-2 py-1.5 rounded text-center"
                     style={{ background: '#161B24', border: '1px solid #1E2530', color: '#C9974D' }}>
                  {c}
                </div>
              ))}
            </div>
            <button onClick={copyAllCodes} className="btn-primary w-full mt-4 inline-flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1m-6-14h6a2 2 0 012 2v8a2 2 0 01-2 2h-6a2 2 0 01-2-2V7a2 2 0 012-2z" />
              </svg>
              Copiar todos
            </button>
            <button onClick={() => setRecoveryCodes(null)} className="text-xs underline mt-3 w-full" style={{ color: '#6B7280' }}>
              Ya los guardé — cerrar
            </button>
          </div>
        )}

        {/* Estado: 2FA enabled */}
        {enabled && !recoveryCodes && (
          <div className="card mb-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0"
                    style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.30)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-400">2FA está habilitado</p>
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>El login te va a pedir el código de Authenticator.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5">
              <button onClick={() => setActionMode('regenerate')}
                      className="btn-secondary text-sm py-2">Regenerar códigos</button>
              <button onClick={() => setActionMode('disable')}
                      className="btn-secondary text-sm py-2"
                      style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#FCA5A5' }}>
                Desactivar 2FA
              </button>
            </div>
          </div>
        )}

        {/* Formulario disable / regenerate */}
        {actionMode && (
          <form onSubmit={runAction} className="card mb-4 space-y-3">
            <p className="text-sm font-semibold">
              {actionMode === 'disable' ? 'Desactivar 2FA' : 'Regenerar códigos de recuperación'}
            </p>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              Por seguridad pedimos tu password actual + un código TOTP (o de recuperación).
            </p>
            <input type="password" required placeholder="Tu contraseña"
                   autoComplete="current-password" className="input"
                   value={actionForm.password}
                   onChange={e => setActionForm(f => ({ ...f, password: e.target.value }))} />
            <input type="text" required placeholder="Código (6 dígitos o XXXX-XXXX)"
                   autoComplete="one-time-code" inputMode="numeric"
                   className="input text-center font-mono"
                   value={actionForm.token}
                   onChange={e => setActionForm(f => ({ ...f, token: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setActionMode(null); setActionForm({ password: '', token: '' }); }}
                      className="btn-secondary text-sm py-2">Cancelar</button>
              <button type="submit" disabled={actionLoading} className="btn-primary text-sm py-2">
                {actionLoading ? 'Procesando...' : (actionMode === 'disable' ? 'Desactivar' : 'Regenerar')}
              </button>
            </div>
          </form>
        )}

        {/* Estado: 2FA disabled, no started setup */}
        {!enabled && !setupData && (
          <div className="card text-center">
            <p className="text-sm mb-4">2FA está <span className="font-semibold" style={{ color: '#FCA5A5' }}>desactivado</span> en tu cuenta.</p>
            <button onClick={startSetup} className="btn-primary px-6 py-2">Activar 2FA</button>
          </div>
        )}

        {/* Setup en curso: QR + confirmacion */}
        {!enabled && setupData && (
          <div className="card space-y-5">
            <div>
              <p className="text-sm font-semibold mb-1">1. Escaneá el QR con tu app</p>
              <p className="text-xs mb-3" style={{ color: '#6B7280' }}>
                Google Authenticator, 1Password, Authy, Microsoft Authenticator — cualquiera sirve.
              </p>
              <div className="flex justify-center p-4 bg-white rounded-xl">
                <img src={setupData.qr_data_url} alt="QR 2FA" />
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: '#6B7280' }}>
                ¿No podés escanear?
              </p>
              <p className="text-xs mb-2" style={{ color: '#9CA3AF' }}>
                Ingresá este código manualmente en la app:
              </p>
              <div className="rounded-lg p-3 font-mono text-sm text-center"
                   style={{ background: '#161B24', border: '1px solid #1E2530', color: '#C9974D', letterSpacing: '2px' }}>
                {setupData.secret}
              </div>
            </div>

            <form onSubmit={confirmEnable} className="space-y-3 pt-3"
                  style={{ borderTop: '1px solid #1E2530' }}>
              <p className="text-sm font-semibold">2. Confirmá con el primer código</p>
              <p className="text-xs" style={{ color: '#6B7280' }}>
                Ingresá el código de 6 dígitos que muestra la app ahora.
              </p>
              <input type="text" required autoFocus
                     autoComplete="one-time-code" inputMode="numeric" pattern="[0-9 ]*"
                     placeholder="000000"
                     className="input text-center text-lg font-mono tracking-widest"
                     maxLength={9}
                     value={confirmToken}
                     onChange={e => setConfirmToken(e.target.value)} />
              <button type="submit" disabled={confirming || !confirmToken}
                      className="btn-primary w-full py-3">
                {confirming ? 'Verificando...' : 'Confirmar y habilitar'}
              </button>
            </form>
          </div>
        )}

        {required && !enabled ? (
          <button onClick={() => { logout(); navigate('/login'); }}
                  className="mt-6 text-xs underline w-full text-center" style={{ color: '#6B7280' }}>
            Cerrar sesión
          </button>
        ) : (
          <button onClick={() => navigate(-1)} className="mt-6 text-xs underline w-full text-center" style={{ color: '#6B7280' }}>
            Volver
          </button>
        )}
      </div>
    </Layout>
  );
};

export default TwoFactorSetup;
