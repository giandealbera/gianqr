import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';

const ROLES = ['cajero', 'jefe_publicas', 'vendedor', 'admin'];
const ROLE_LABELS = {
  admin:         '🔑 Dueño',
  cajero:        '💵 Cajero',
  promotor:      '🔗 Públicas (legacy)',
  jefe_publicas: '👑 Jefe de Públicas',
  vendedor:      '🔗 Vendedor',
};
const PUBLICAS_ROLES = ['promotor', 'jefe_publicas', 'vendedor'];
const emptyForm = { name: '', apellido: '', celular: '', localidad: '', email: '', password: '', role: 'vendedor', promo_code: '', commission: 800, leader_id: '', leader_commission: 400 };

const Users = () => {
  const [users,       setUsers]       = useState([]);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState(emptyForm);
  const [saving,      setSaving]      = useState(false);
  const [editCommId,  setEditCommId]  = useState(null); // id del usuario editando comisión
  const [commForm,    setCommForm]    = useState({ commission: 800, leader_commission: 400 });

  const jefes = users.filter(u => (u.role === 'jefe_publicas' || u.role === 'promotor') && u.is_active);

  const load = () => api.get('/users').then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users', form);
      toast.success('Usuario creado!');
      setShowForm(false);
      setForm(emptyForm);
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

  const openEditComm = (u) => {
    setEditCommId(u.id);
    setCommForm({ commission: u.commission ?? 800, leader_commission: u.leader_commission ?? 400 });
  };

  const saveCommission = async (userId) => {
    try {
      await api.patch(`/users/${userId}/commission`, commForm);
      toast.success('Comisión actualizada');
      setEditCommId(null);
      load();
    } catch {
      toast.error('Error al actualizar comisión');
    }
  };

  const isPublicas = PUBLICAS_ROLES.includes(form.role);

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
                <label className="text-sm text-gray-400 block mb-1">Apellido</label>
                <input className="input" value={form.apellido}
                  onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))} />
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
                <label className="text-sm text-gray-400 block mb-1">Celular</label>
                <input className="input" placeholder="ej: 2645 123456" value={form.celular}
                  onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-1">Localidad</label>
                <input className="input" placeholder="ej: San Juan" value={form.localidad}
                  onChange={e => setForm(f => ({ ...f, localidad: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm text-gray-400 block mb-1">Rol *</label>
                <select className="input" value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>

              {isPublicas && (
                <>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Código de promotor</label>
                    <input className="input" placeholder="Ej: PROMO2024" value={form.promo_code}
                      onChange={e => setForm(f => ({ ...f, promo_code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Comisión propia ($ por entrada)</label>
                    <input type="number" className="input" min="0" value={form.commission}
                      onChange={e => setForm(f => ({ ...f, commission: e.target.value }))} />
                  </div>
                  {form.role === 'vendedor' && (
                    <>
                      <div>
                        <label className="text-sm text-gray-400 block mb-1">Jefe de Públicas</label>
                        <select className="input" value={form.leader_id}
                          onChange={e => setForm(f => ({ ...f, leader_id: e.target.value }))}>
                          <option value="">Sin jefe asignado</option>
                          {jefes.map(p => <option key={p.id} value={p.id}>{p.name} {p.apellido || ''}</option>)}
                        </select>
                      </div>
                      {form.leader_id && (
                        <div>
                          <label className="text-sm text-gray-400 block mb-1">Comisión del jefe ($ por entrada)</label>
                          <input type="number" className="input" min="0" value={form.leader_commission}
                            onChange={e => setForm(f => ({ ...f, leader_commission: e.target.value }))} />
                        </div>
                      )}
                    </>
                  )}
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
                <th className="text-left pb-3 hidden sm:table-cell">Contacto</th>
                <th className="text-left pb-3">Rol</th>
                <th className="text-left pb-3 hidden md:table-cell">Código</th>
                <th className="text-left pb-3 hidden md:table-cell">Jefe</th>
                <th className="text-left pb-3">Estado</th>
                <th className="text-right pb-3">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-800/40">
                  <td className="py-3">
                    <p className="font-medium">{u.name} {u.apellido || ''}</p>
                    {u.localidad && <p className="text-xs text-gray-500">{u.localidad}</p>}
                  </td>
                  <td className="py-3 text-gray-400 hidden sm:table-cell">
                    <p>{u.email}</p>
                    {u.celular && <p className="text-xs text-gray-500">{u.celular}</p>}
                  </td>
                  <td className="py-3">{ROLE_LABELS[u.role] || u.role}</td>
                  <td className="py-3 text-gray-400 font-mono text-xs hidden md:table-cell">{u.promo_code || '—'}</td>
                  <td className="py-3 text-gray-400 text-xs hidden md:table-cell">{u.leader_name || '—'}</td>
                  <td className="py-3">
                    <span className={u.is_active ? 'badge-pagado' : 'badge-cancelado'}>
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {PUBLICAS_ROLES.includes(u.role) && (
                        <button onClick={() => editCommId === u.id ? setEditCommId(null) : openEditComm(u)}
                          className="text-xs text-blue-400 hover:text-blue-200 transition-colors">
                          {editCommId === u.id ? 'Cancelar' : '$ Comisión'}
                        </button>
                      )}
                      <button onClick={() => toggleActive(u)}
                        className="text-xs text-gray-400 hover:text-white transition-colors">
                        {u.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                    {editCommId === u.id && (
                      <div className="mt-2 p-3 bg-gray-800 rounded-xl text-left space-y-2">
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase block mb-1">Comisión propia ($ x entrada)</label>
                          <input type="number" className="input text-sm py-1" min="0"
                            value={commForm.commission}
                            onChange={e => setCommForm(f => ({ ...f, commission: parseFloat(e.target.value) }))} />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 uppercase block mb-1">Comisión jefe ($ x entrada)</label>
                          <input type="number" className="input text-sm py-1" min="0"
                            value={commForm.leader_commission}
                            onChange={e => setCommForm(f => ({ ...f, leader_commission: parseFloat(e.target.value) }))} />
                        </div>
                        <button onClick={() => saveCommission(u.id)}
                          className="w-full btn-primary text-xs py-1.5">
                          Guardar
                        </button>
                      </div>
                    )}
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
