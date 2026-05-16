import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Layout from '../../components/Layout';

const EMPTY = { id: null, nombre: '', apellido: '', alias_cbu: '', notas: '' };

const Proveedores = () => {
  const [list, setList]       = useState([]);
  const [search, setSearch]   = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [showForm, setShow]   = useState(false);
  const [saving, setSaving]   = useState(false);

  const load = async (q = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set('search', q);
      const r = await api.get(`/proveedores?${params}`);
      setList(r.data);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => { e.preventDefault(); load(search); };

  const openCreate = () => { setForm(EMPTY); setShow(true); };
  const openEdit = (p) => {
    setForm({
      id: p.id,
      nombre: p.nombre || '',
      apellido: p.apellido || '',
      alias_cbu: p.alias_cbu || '',
      notas: p.notas || '',
    });
    setShow(true);
  };
  const cancel = () => { setShow(false); setForm(EMPTY); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      const body = {
        nombre:    form.nombre,
        apellido:  form.apellido,
        alias_cbu: form.alias_cbu,
        notas:     form.notas,
      };
      if (form.id) {
        await api.put(`/proveedores/${form.id}`, body);
        toast.success('Proveedor actualizado');
      } else {
        await api.post('/proveedores', body);
        toast.success('Proveedor creado');
      }
      cancel();
      load(search);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!confirm(`¿Eliminar a ${p.nombre}${p.apellido ? ' ' + p.apellido : ''}?`)) return;
    try {
      await api.delete(`/proveedores/${p.id}`);
      toast.success('Proveedor eliminado');
      load(search);
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Proveedores</h1>
          <button onClick={openCreate} className="btn-primary">+ Nuevo</button>
        </div>

        {/* Buscar */}
        <form onSubmit={handleSearch} className="card mb-6 flex gap-3">
          <input
            type="text"
            placeholder="Buscar por nombre, alias/CBU o notas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input flex-1"
          />
          <button type="submit" className="btn-secondary">Buscar</button>
        </form>

        {/* Form (crear/editar) */}
        {showForm && (
          <form onSubmit={submit} className="card mb-6 space-y-3">
            <h2 className="font-semibold">{form.id ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Nombre *</label>
                <input
                  className="input"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Apellido</label>
                <input
                  className="input"
                  value={form.apellido}
                  onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Alias o CBU</label>
              <input
                className="input"
                placeholder="alias.mercado.pago  o  2850590940090418135201"
                value={form.alias_cbu}
                onChange={e => setForm(f => ({ ...f, alias_cbu: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Notas</label>
              <textarea
                className="input"
                rows={2}
                placeholder="Qué provee, teléfono, banco, etc."
                value={form.notas}
                onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : (form.id ? 'Guardar cambios' : 'Crear proveedor')}
              </button>
              <button type="button" onClick={cancel} className="btn-secondary">Cancelar</button>
            </div>
          </form>
        )}

        {loading && <p className="text-gray-500">Cargando...</p>}

        {!loading && list.length === 0 && (
          <div className="card text-center text-gray-500 py-10">
            {search
              ? `Sin resultados para "${search}"`
              : 'No hay proveedores cargados todavía. Tocá "+ Nuevo" para agregar el primero.'}
          </div>
        )}

        {!loading && list.length > 0 && (
          <div className="space-y-2">
            {list.map(p => (
              <div key={p.id} className="card hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white">
                      {p.nombre} {p.apellido || ''}
                    </p>
                    {p.alias_cbu && (
                      <button
                        type="button"
                        onClick={() => copy(p.alias_cbu, 'Alias/CBU')}
                        className="mt-1 text-sm text-brand hover:underline break-all text-left"
                        title="Click para copiar"
                      >
                        {p.alias_cbu}
                      </button>
                    )}
                    {p.notas && <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">{p.notas}</p>}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => openEdit(p)} className="text-xs text-gray-400 hover:text-white px-2 py-1">Editar</button>
                    <button onClick={() => remove(p)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1">Eliminar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Proveedores;
