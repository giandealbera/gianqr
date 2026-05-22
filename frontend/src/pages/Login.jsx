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
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Bienvenido, ${user.name}`);
      navigate(roleRedirect[user.role] || '/admin');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(160deg, #07090E 0%, #0D1117 50%, #0A0F18 100%)' }}>
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

        {/* Card */}
        <div className="rounded-2xl p-6 space-y-5" style={{ background: '#0D1117', border: '1px solid #1E2530' }}>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#6B7280' }}>Email</label>
            <input
              type="email"
              required
              autoComplete="email"
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
              className="input"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleSubmit}
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
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#2D3748' }}>GianQR v1.0</p>
      </div>
    </div>
  );
};

export default Login;
