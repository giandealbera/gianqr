import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';

const Zonas = () => {
  const [list, setList]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState({ id: null, name: '' });
  const [saving, setSaving]   = useState(false);

  const load = () => {
    setLoading(true);
    api.get('/zonas').then(r => setList(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    setSaving(true);
    try {
      if (form.id) {
        await api.put(`/zonas/${form.id}`, { name });
        toast.success('Zona actualizada');
      } else {
        await api.post('/zonas', { name });
        toast.success('Zona creada');
      }
      setForm({ id: null, name: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (z) => {
    if (!confirm(`¿Eliminar la zona "${z.name}"? Los vendedores que estaban en esta zona quedarán sin zona asignada.`)) return;
    try {
      await api.delete(`/zonas/${z.id}`);
      toast.success('Zona eliminada');
      load();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Zonas</h1>
        <p className="text-sm text-gray-500 mb-6">
          Agrupá vendedores y jefes de públicas por zona geográfica. Sirve para ver rendiciones agrupadas y asignar comisiones distintas.
        </p>

        <form onSubmit={submit} className="card mb-6 flex gap-3">
          <input
            type="text"
            placeholder={form.id ? 'Editando zona...' : 'Nueva zona (ej: Norte, Centro, Sur)'}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="input flex-1"
            required
          />
          <button type="submit" disabled={saving} className="btn-primary shrink-0">
            {saving ? '...' : form.id ? 'Guardar' : '+ Crear'}
          </button>
          {form.id && (
            <button type="button" onClick={() => setForm({ id: null, name: '' })} className="btn-secondary shrink-0">
              Cancelar
            </button>
          )}
        </form>

        {loading && <p className="text-gray-500">Cargando...</p>}

        {!loading && list.length === 0 && (
          <div className="card text-center text-gray-500 py-10">
            No hay zonas todavía. Creá la primera arriba.
          </div>
        )}

        {!loading && list.length > 0 && (
          <div className="space-y-2">
            {list.map(z => (
              <div key={z.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{z.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {z.publicas_count} público{z.publicas_count == 1 ? '' : 's'} asignado{z.publicas_count == 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setForm({ id: z.id, name: z.name })}
                    className="text-xs text-gray-400 hover:text-white px-3 py-1.5"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => remove(z)}
                    className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Zonas;
