import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const roleRedirect = {
  admin:         '/admin',
  jefe_publicas: '/promotor',
  vendedor:      '/promotor',
  owner:         '/eventos',
};

const Login = () => {
  const { login, verifyTwoFactor } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  // Segundo paso del login cuando el user tiene 2FA. Si tfaState es null,
  // mostramos email+password. Si es un objeto { partial_token }, mostramos
  // el input del codigo.
  const [tfaState, setTfaState] = useState(null);
  const [tfaCode, setTfaCode]   = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(form.email, form.password);
      if (result?.needs_2fa) {
        setTfaState({ partial_token: result.partial_token });
        toast('Ingresá el código de 2FA', { icon: '🔐' });
        return;
      }
      toast.success(`Bienvenido, ${result.name}`);
      navigate(roleRedirect[result.role] || '/admin');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  const handleTfaSubmit = async (e) => {
    e.preventDefault();
    if (!tfaCode) return;
    setLoading(true);
    try {
      const user = await verifyTwoFactor(tfaState.partial_token, tfaCode);
      toast.success(`Bienvenido, ${user.name}`);
      navigate(roleRedirect[user.role] || '/admin');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Código incorrecto');
    } finally {
      setLoading(false);
    }
  };

  const cancelTfa = () => {
    setTfaState(null);
    setTfaCode('');
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4" style={{ background: 'linear-gradient(160deg, #07090E 0%, #0D1117 50%, #0A0F18 100%)' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
               style={{ background: 'linear-gradient(135deg, #C9974D, #A87B35)', boxShadow: '0 0 40px rgba(201,151,77,0.2)' }}>
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: '#C9974D' }}>GianQR</h1>
          <p className="text-sm mt-1" style={{ color: '#4A5568' }}>Sistema de Entradas</p>
        </div>

        {/* Paso 1: email + password. Paso 2 (2FA): codigo de Authenticator. */}
        {!tfaState ? (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl p-6 space-y-5"
            style={{ background: '#0D1117', border: '1px solid #1E2530' }}
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#6B7280' }}>Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                autoCapitalize="off"
                spellCheck="false"
                enterKeyHint="next"
                className="input"
                placeholder="tuemail@ejemplo.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#6B7280' }}>Contraseña</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                enterKeyHint="go"
                className="input"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold tracking-wider text-sm transition-all duration-150 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #C9974D, #A87B35)', color: '#fff', boxShadow: '0 4px 24px rgba(201,151,77,0.25)' }}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>

            <div className="text-center pt-2">
              <Link
                to="/olvide-password"
                className="text-xs hover:underline transition-colors"
                style={{ color: '#6B7280' }}
                onMouseEnter={e => e.target.style.color = '#C9974D'}
                onMouseLeave={e => e.target.style.color = '#6B7280'}
              >
                Olvidé mi contraseña
              </Link>
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleTfaSubmit}
            className="rounded-2xl p-6 space-y-5"
            style={{ background: '#0D1117', border: '1px solid #1E2530' }}
          >
            <div className="text-center">
              <p className="text-2xl mb-2">🔐</p>
              <p className="text-sm font-semibold">Verificación en dos pasos</p>
              <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                Ingresá el código de 6 dígitos de tu app de autenticación.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#6B7280' }}>
                Código
              </label>
              <input
                type="text"
                required
                autoFocus
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9 ]*"
                enterKeyHint="go"
                className="input text-center text-lg font-mono tracking-widest"
                placeholder="000000"
                maxLength={9}
                value={tfaCode}
                onChange={e => setTfaCode(e.target.value)}
              />
              <p className="text-[10px] mt-2 text-center" style={{ color: '#4B5563' }}>
                Si perdiste el dispositivo, podés usar uno de tus códigos de recuperación (formato XXXX-XXXX).
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !tfaCode}
              className="w-full py-3 rounded-xl font-bold tracking-wider text-sm transition-all duration-150 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #C9974D, #A87B35)', color: '#fff', boxShadow: '0 4px 24px rgba(201,151,77,0.25)' }}
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </button>

            <button
              type="button"
              onClick={cancelTfa}
              className="w-full text-xs underline" style={{ color: '#6B7280' }}
            >
              Volver al login
            </button>
          </form>
        )}

        <p className="text-center text-xs mt-6" style={{ color: '#2D3748' }}>GianQR v1.0</p>
      </div>
    </div>
  );
};

export default Login;
