import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const ForgotPassword = () => {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar el pedido. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4" style={{ background: 'linear-gradient(160deg, #07090E 0%, #0D1117 50%, #0A0F18 100%)' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black tracking-tight" style={{ color: '#C9974D' }}>GianQR</h1>
          <p className="text-sm mt-1" style={{ color: '#4A5568' }}>Recuperar acceso</p>
        </div>

        <div className="rounded-2xl p-6 space-y-5" style={{ background: '#0D1117', border: '1px solid #1E2530' }}>
          {sent ? (
            <>
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
                     style={{ background: 'rgba(52,211,153,0.15)' }}>
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-white mb-2">Pedido enviado</h2>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Si el email <span className="text-gray-200">{email}</span> está registrado, te enviamos un link para resetear tu contraseña. El link vale 1 hora.
                </p>
                <p className="text-xs text-gray-500 mt-3">
                  Revisá tu casilla (y spam). Si no llega en unos minutos, podés volver a pedirlo.
                </p>
              </div>
              <Link
                to="/login"
                className="block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all"
                style={{ background: 'linear-gradient(135deg, #C9974D, #A87B35)', color: '#fff' }}
              >
                Volver a inicio de sesión
              </Link>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">¿Olvidaste tu contraseña?</h2>
                <p className="text-xs text-gray-500">Ingresá tu email y te enviamos un link para resetearla.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#6B7280' }}>Email</label>
                <input
                  type="email"
                  required
                  className="input"
                  placeholder="tuemail@ejemplo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="button"
                disabled={loading || !email}
                onClick={handleSubmit}
                className="w-full py-3 rounded-xl font-bold tracking-wider text-sm transition-all duration-150 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #C9974D, #A87B35)', color: '#fff', boxShadow: '0 4px 24px rgba(201,151,77,0.25)' }}
              >
                {loading ? 'Enviando...' : 'Enviar link de reset'}
              </button>

              <div className="text-center pt-2">
                <Link to="/login" className="text-xs hover:underline" style={{ color: '#6B7280' }}>
                  ← Volver a inicio de sesión
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
