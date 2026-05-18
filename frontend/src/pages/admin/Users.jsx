import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';

const ROLES = ['cajero', 'jefe_publicas', 'vendedor', 'admin'];
const ROLE_LABELS = {
  admin:         'Dueño',
  cajero:        'Cajero',
  promotor:      'Públicas (legacy)',
  jefe_publicas: 'Jefe de Públicas',
  vendedor:      'Vendedor',
};
const PUBLICAS_ROLES = ['promotor', 'jefe_publicas', 'vendedor'];
const emptyForm = { name: '', apellido: '', celular: '', localidad: '', email: '', password: '', role: 'vendedor', promo_code: '', commission: 800, leader_id: '', leader_commission: 400, zona_id: '' };

const Users = () => {
  const [users,       setUsers]       = useState([]);
  const [zonas,       setZonas]       = useState([]);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState(emptyForm);
  const [saving,      setSaving]      = useState(false);
  const [editCommId,  setEditCommId]  = useState(null);
  const [commForm,    setCommForm]    = useState({ commission: 800, leader_commission: 400 });
  const [editRoleId,  setEditRoleId]  = useState(null); // id del usuario cambiando rol
  const [createdUser, setCreatedUser] = useState(null);

  const jefes = users.filter(u => (u.role === 'jefe_publicas' || u.role === 'promotor') && u.is_active);

  const load = () => api.get('/users').then(r => setUsers(r.data));
  const loadZonas = () => api.get('/zonas').then(r => setZonas(r.data)).catch(() => {});
  useEffect(() => { load(); loadZonas(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users', form);
      toast.success('Usuario creado');
      setCreatedUser({
        name:     form.name,
        apellido: form.apellido,
        role:     form.role,
        usuario:  form.email,
        password: form.password,
      });
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al crear usuario');
    } finally {
      setSaving(false);
    }
  };

  const copyCreds = () => {
    if (!createdUser) return;
    const txt = `GianQR - Acceso\n\nNombre: ${createdUser.name} ${createdUser.apellido || ''}\nRol: ${ROLE_LABELS[createdUser.role] || createdUser.role}\nUsuario: ${createdUser.usuario}\nContrasena: ${createdUser.password}\n\nIngresa en: ${window.location.origin}/login`;
    navigator.clipboard.writeText(txt).then(() => toast.success('Credenciales copiadas'));
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

  const changeRole = async (u, newRole) => {
    try {
      await api.put(`/users/${u.id}`, { ...u, role: newRole });
      toast.success(`Rol cambiado a ${ROLE_LABELS[newRole] || newRole}`);
      setEditRoleId(null);
      load();
    } catch {
      toast.error('Error al cambiar rol');
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
          <button onClick={() => { setShowForm(!showForm); setCreatedUser(null); }} className="btn-primary">
            {showForm ? 'Cancelar' : '+ Nuevo usuario'}
          </button>
        </div>

        {/* Credenciales del usuario recien creado */}
        {createdUser && (
          <div className="mb-6 rounded-xl p-4 space-y-3"
               style={{ background: 'rgba(201,151,77,0.08)', border: '1px solid rgba(201,151,77,0.3)' }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                   style={{ background: 'rgba(52,211,153,0.15)' }}>
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{ROLE_LABELS[createdUser.role] || createdUser.role} creado</p>
                <p className="text-xs" style={{ color: '#6B7280' }}>
                  Pasale estas credenciales a {createdUser.name} para que pueda entrar al sistema
                </p>
              </div>
              <button onClick={() => setCreatedUser(null)}
                      className="text-gray-500 hover:text-white text-lg leading-none">×</button>
            </div>

            <div className="space-y-2 rounded-lg p-3" style={{ background: '#0D1117', border: '1px solid #1E2530' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-wider" style={{ color: '#6B7280' }}>Usuario</span>
                <span className="font-mono text-sm" style={{ color: '#C9974D' }}>{createdUser.usuario}</span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-800">
                <span className="text-xs uppercase tracking-wider" style={{ color: '#6B7280' }}>Contrasena</span>
                <span className="font-mono text-sm" style={{ color: '#C9974D' }}>{createdUser.password}</span>
              </div>
            </div>

            <button onClick={copyCreds} className="btn-primary w-full text-sm py-2">
              Copiar credenciales para compartir
            </button>
            <p className="text-[10px] text-center" style={{ color: '#4B5563' }}>
              Por seguridad, esta es la unica vez que vas a ver la contrasena
            </p>
          </div>
        )}

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
                <label className="text-sm text-gray-400 block mb-1">Usuario *</label>
                <input type="text" className="input" required value={form.email}
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
                    <label className="text-sm text-gray-400 block mb-1">Zona</label>
                    <select className="input" value={form.zona_id}
                      onChange={e => setForm(f => ({ ...f, zona_id: e.target.value }))}>
                      <option value="">Sin zona</option>
                      {zonas.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                    {zonas.length === 0 && (
                      <p className="text-xs text-gray-500 mt-1">Aún no hay zonas creadas. Andá a "Zonas" para crear.</p>
                    )}
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

        <div className="space-y-3">
          {users.map(u => (
            <div key={u.id} className="card">
              <div className="flex items-start justify-between gap-3">
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{u.name} {u.apellido || ''}</p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                      u.is_active ? 'bg-emerald-900/40 text-emerald-400' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-0.5">{u.email}{u.celular ? ` · ${u.celular}` : ''}</p>
                  {u.localidad && <p className="text-xs text-gray-500">{u.localidad}</p>}
                  {u.promo_code && (
                    <p className="text-xs text-gray-500 mt-1">
                      Código: <span className="font-mono text-gray-300">{u.promo_code}</span>
                      {u.leader_name && <span> · Jefe: {u.leader_name}</span>}
                    </p>
                  )}
                </div>

                {/* Rol + acciones */}
                <div className="shrink-0 text-right">
                  {/* Rol editable */}
                  {editRoleId === u.id ? (
                    <div className="flex items-center gap-2 mb-2">
                      <select
                        defaultValue={u.role}
                        onChange={e => changeRole(u, e.target.value)}
                        className="input text-xs py-1 w-40"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                      <button onClick={() => setEditRoleId(null)} className="text-xs text-gray-500 hover:text-white">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditRoleId(u.id); setEditCommId(null); }}
                      className="text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded-lg mb-2 transition-colors"
                      title="Cambiar rol"
                    >
                      {ROLE_LABELS[u.role] || u.role} ✎
                    </button>
                  )}

                  {/* Acciones */}
                  <div className="flex items-center justify-end gap-2">
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
                </div>
              </div>

              {/* Editor de comisión */}
              {editCommId === u.id && (
                <div className="mt-3 pt-3 border-t border-gray-800 grid grid-cols-2 gap-3">
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
                  <div className="col-span-2">
                    <button onClick={() => saveCommission(u.id)} className="btn-primary text-xs py-1.5 w-full">
                      Guardar comisión
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Users;
