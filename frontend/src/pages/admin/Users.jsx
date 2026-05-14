import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';

const ROLES = ['admin', 'cajero', 'portero', 'promotor'];
const ROLE_LABELS = { admin: '🔑 Admin', cajero: '💵 Cajero', portero: '🚪 Portero', promotor: '🔗 Promotor' };

const Users = () => {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'cajero', promo_code: '', commission: '' });
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/users').then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users', form);
      toast.success('Usuario creado!');
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'cajero', promo_code: '', commission: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear usuario');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u) => {
    try {
      if (u.is_active) {
        await api.delete(`/users/${u.id}`);
        toast.success('Usuario desactivado');
      } else {
        await api.put(`/users/${u.id}`, { ...u, is_active: true });
        toast.success('Usuario activado');
      }
      load();
    } catch {
      toast.error('Error al actualizar usuario');
    }
  };

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Usuarios</h1>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            {showForm ? 'Cancelar' : '+ Nuevo usuario'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="card mb-8 space-y-4">
            <h2 className="font-semibold">Nuevo usuario</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Nombre *</label>
                <input className="input" required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Email *</label>
                <input type="email" className="input" required value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Contraseña *</label>
                <input type="password" className="input" required value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Rol *</label>
                <select className="input" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {form.role === 'promotor' && (
                <>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Código de promotor</label>
                    <input className="input" placeholder="Ej: PROMO2024" value={form.promo_code}
                      onChange={e => setForm(f => ({ ...f, promo_code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Comisión %</label>
                    <input type="number" className="input" min="0" max="100" value={form.commission}
                      onChange={e => setForm(f => ({ ...f, commission: e.target.value }))} />
                  </div>
                </>
              )}
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Guardando...' : 'Crear usuario'}
            </button>
          </form>
        )}

        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="text-left pb-3">Nombre</th>
                <th className="text-left pb-3">Email</th>
                <th className="text-left pb-3">Rol</th>
                <th className="text-left pb-3">Código promotor</th>
                <th className="text-left pb-3">Estado</th>
                <th className="text-right pb-3">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-800/40">
                  <td className="py-3 font-medium">{u.name}</td>
                  <td className="py-3 text-gray-400">{u.email}</td>
                  <td className="py-3">{ROLE_LABELS[u.role]}</td>
                  <td className="py-3 text-gray-400 font-mono text-xs">{u.promo_code || '—'}</td>
                  <td className="py-3">
                    <span className={u.is_active ? 'badge-pagado' : 'badge-cancelado'}>
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => toggleActive(u)}
                      className="text-xs text-gray-400 hover:text-white transition-colors">
                      {u.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
};

export default Users;
