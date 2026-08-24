import { useEffect, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import { exportCsv } from '../../utils/exportCsv';
import { Icon } from '../../components/Icon';
import toast from 'react-hot-toast';

/**
 * Lista de compradores que pidieron recibir descuentos y preventas.
 *
 * Solo aparecen los que marcaron la casilla al comprar. Los emails cargados
 * antes de que existiera la casilla NO estan: esa gente dejo su mail para
 * recibir el QR, no para recibir novedades.
 *
 * La idea es exportar y mandar desde una herramienta de mailing (Mailchimp,
 * Brevo), que ya trae plantillas, baja automatica y estadisticas.
 */
const Newsletter = () => {
  const [datos, setDatos]     = useState(null);
  const [eventos, setEventos] = useState([]);
  const [evSel, setEvSel]     = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get('/events').then(r => setEventos(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setCargando(true);
    api.get(`/newsletter${evSel ? `?event_id=${evSel}` : ''}`)
      .then(r => setDatos(r.data))
      .catch(e => toast.error(e.response?.data?.error || 'No se pudo cargar la lista'))
      .finally(() => setCargando(false));
  }, [evSel]);

  const exportar = () => {
    const filas = datos?.suscriptores || [];
    if (filas.length === 0) return toast.error('No hay suscriptores para exportar');
    exportCsv({
      filename: 'suscriptores-newsletter',
      rows: filas,
      columns: [
        { key: 'email',    label: 'Email' },
        { key: 'nombre',   label: 'Nombre' },
        { key: 'apellido', label: 'Apellido' },
        { key: 'desde',    label: 'Suscripto desde', format: (v) => (v || '').slice(0, 10) },
      ],
    });
    toast.success(`${filas.length} contactos exportados`);
  };

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-semibold tracking-tight mb-1">Lista de descuentos</h1>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
          Compradores que pidieron recibir descuentos y preventas. Exportalos para
          mandarles el newsletter desde tu herramienta de mailing.
        </p>

        <div className="card mb-4">
          <label className="text-sm text-gray-400 block mb-1">Evento</label>
          <select className="input" value={evSel} onChange={e => setEvSel(e.target.value)}>
            <option value="">Todos mis eventos</option>
            {eventos.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.name} — {new Date(ev.date + 'T12:00:00').toLocaleDateString('es-AR')}
              </option>
            ))}
          </select>
        </div>

        <div className="card mb-4 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: '#6B7280' }}>
              Suscriptores
            </p>
            <p className="stat-num font-black" style={{ color: '#C9974D' }}>
              {cargando ? '—' : (datos?.total ?? 0)}
            </p>
          </div>
          <button onClick={exportar} disabled={cargando || !datos?.total}
                  className="btn-primary text-sm py-2.5 px-4 disabled:opacity-40">
            Exportar
          </button>
        </div>

        {cargando ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand" />
          </div>
        ) : (datos?.suscriptores || []).length === 0 ? (
          <div className="text-center py-14">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
                 style={{ background: '#161B24', border: '1px solid #1E2530', color: '#4B5563' }}>
              <Icon name="empty" className="w-6 h-6" />
            </div>
            <p className="text-gray-400 text-sm">Todavía no hay suscriptores</p>
            <p className="text-xs mt-1.5 max-w-sm mx-auto leading-relaxed" style={{ color: '#4B5563' }}>
              Se van sumando solos: al comprar, quien deja su email puede marcar
              que quiere recibir descuentos y preventas.
            </p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800">
                    <th className="text-left py-3 px-4 font-medium">Email</th>
                    <th className="text-left py-3 px-4 font-medium">Nombre</th>
                    <th className="text-right py-3 px-4 font-medium">Desde</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {datos.suscriptores.map(s => (
                    <tr key={s.email}>
                      <td className="py-3 px-4 break-all">{s.email}</td>
                      <td className="py-3 px-4" style={{ color: '#9AA3B2' }}>
                        {[s.nombre, s.apellido].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap" style={{ color: '#6B7280' }}>
                        {(s.desde || '').slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Newsletter;
