import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const roleRedirect = {
  admin:         '/admin',
  cajero:        '/caja',
  promotor:      '/promotor',
  jefe_publicas: '/promotor',
  vendedor:      '/promotor',
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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-brand tracking-tight">GianQR</h1>
          <p className="text-slate-500 text-sm mt-2">Sistema de Entradas</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="text-base font-semibold text-slate-200">Iniciar sesion</h2>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Usuario</label>
            <input
              type="text"
              required
              className="input"
              placeholder="admin"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Contrasena</label>
            <input
              type="password"
              required
              className="input"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-700 mt-6">GianQR v1.0</p>
      </div>
    </div>
  );
};

export default Login;
