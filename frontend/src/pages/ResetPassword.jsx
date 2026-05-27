import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/axios';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [form, setForm]       = useState({ password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (form.password !== form.confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: form.password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo resetear la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center px-4" style={{ background: 'linear-gradient(160deg, #07090E 0%, #0D1117 50%, #0A0F18 100%)' }}>
      <div className="w-full max-w-sm">

        <div className="text-center mb-10">
          <h1 className="text-3xl font-black tracking-tight" style={{ color: '#C9974D' }}>GianQR</h1>
          <p className="text-sm mt-1" style={{ color: '#4A5568' }}>Nueva contraseña</p>
        </div>

        <div className="rounded-2xl p-6 space-y-5" style={{ background: '#0D1117', border: '1px solid #1E2530' }}>
          {done ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
                   style={{ background: 'rgba(52,211,153,0.15)' }}>
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Contraseña actualizada</h2>
              <p className="text-sm text-gray-400">Redirigiendo al login...</p>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Elegí tu nueva contraseña</h2>
                <p className="text-xs text-gray-500">Mínimo 8 caracteres.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#6B7280' }}>Nueva contraseña</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="input"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#6B7280' }}>Confirmar contraseña</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="input"
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                type="button"
                disabled={loading || !form.password || !form.confirm}
                onClick={handleSubmit}
                className="w-full py-3 rounded-xl font-bold tracking-wider text-sm transition-all duration-150 disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #C9974D, #A87B35)', color: '#fff', boxShadow: '0 4px 24px rgba(201,151,77,0.25)' }}
              >
                {loading ? 'Guardando...' : 'Actualizar contraseña'}
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

export default ResetPassword;
