import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import useNotifications from '../hooks/useNotifications';

const Configuracion = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const notif = useNotifications();

  const toggleNotif = async () => {
    if (notif.subscribed) {
      await notif.disable();
      toast.success('Notificaciones desactivadas');
    } else {
      const r = await notif.enable();
      if (r.ok) toast.success('Notificaciones activadas');
      else if (r.reason === 'denied') toast.error('Diste permiso "Bloquear". Hay que cambiarlo desde Ajustes del navegador.');
      else if (r.reason === 'server-not-configured') toast.error('Notificaciones todavía no habilitadas por el admin');
      else toast.error('No se pudieron activar');
    }
  };
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError('Completá todos los campos');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('Las contraseñas nuevas no coinciden');
      return;
    }
    if (form.currentPassword === form.newPassword) {
      setError('La nueva contraseña tiene que ser distinta a la actual');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Contraseña actualizada. Volvé a iniciar sesión.');
      setTimeout(() => { logout(); navigate('/login'); }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-xl mx-auto">
        <h1 className="text-xl font-semibold tracking-tight mb-1">Configuración</h1>
        <p className="text-sm text-gray-500 mb-6">Tu cuenta y preferencias.</p>

        {/* Datos de la cuenta */}
        <div className="card mb-6">
          <h2 className="font-semibold mb-3">Datos de la cuenta</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400">Nombre</span>
              <span className="text-white">{user?.name}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400">Email</span>
              <span className="text-white">{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Rol</span>
              <span className="text-white capitalize">{user?.role?.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* Notificaciones — solo si el browser soporta. Si el servidor todavia
            no tiene VAPID keys, mostramos pero deshabilitado. */}
        {notif.supported && (
          <div className="card mb-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">Notificaciones</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Avisos del sistema en tu dispositivo (cortes de venta, recordatorios, etc.).
                </p>
                {!notif.serverEnabled && (
                  <p className="text-[11px] text-amber-400 mt-1.5">Próximamente — el sistema todavía no las está enviando.</p>
                )}
                {notif.permission === 'denied' && (
                  <p className="text-[11px] text-red-400 mt-1.5">Bloqueadas — habilitalas desde los ajustes del navegador.</p>
                )}
              </div>
              <button
                onClick={toggleNotif}
                disabled={notif.loading || notif.permission === 'denied'}
                className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 ${notif.subscribed ? 'bg-brand' : 'bg-gray-700'}`}
                role="switch"
                aria-checked={notif.subscribed}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notif.subscribed ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        )}

        {/* Cambio de contraseña */}
        <div className="card">
          <h2 className="font-semibold mb-1">Cambiar contraseña</h2>
          <p className="text-xs text-gray-500 mb-4">
            Después de cambiarla vas a tener que volver a iniciar sesión.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Contraseña actual</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                className="input"
                value={form.currentPassword}
                onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Nueva contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
                value={form.newPassword}
                onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
              />
              <p className="text-xs text-gray-600 mt-1">Mínimo 8 caracteres.</p>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Confirmar nueva contraseña</label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="input"
                value={form.confirmPassword}
                onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default Configuracion;
