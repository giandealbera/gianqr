// Sesiones del usuario logueado — ve dispositivos donde tiene sesion
// activa y puede revocar individualmente o "cerrar todas las otras".
//
// La sesion actual se marca con un badge "Esta sesión" y no tiene boton
// de revocar (eso seria autoexcluirse; preferimos que use logout).

import { useEffect, useState } from 'react';
import api from '../api/axios';
import Layout from '../components/Layout';
import { useConfirm } from '../context/ConfirmContext';
import toast from 'react-hot-toast';

// Heuristica simple para identificar el dispositivo a partir del UA.
// No es perfecta pero ayuda al usuario a reconocer cual es cual.
function describeUA(ua) {
  if (!ua) return 'Desconocido';
  const s = ua.toLowerCase();
  let device = 'Desktop';
  if (s.includes('iphone') || s.includes('ipod')) device = 'iPhone';
  else if (s.includes('ipad')) device = 'iPad';
  else if (s.includes('android')) device = s.includes('mobile') ? 'Android' : 'Tablet Android';
  else if (s.includes('mobile')) device = 'Mobile';
  let browser = 'Navegador';
  if (s.includes('edg/')) browser = 'Edge';
  else if (s.includes('chrome/') && !s.includes('edg/')) browser = 'Chrome';
  else if (s.includes('firefox/')) browser = 'Firefox';
  else if (s.includes('safari/') && !s.includes('chrome/')) browser = 'Safari';
  let os = '';
  if (s.includes('windows')) os = ' · Windows';
  else if (s.includes('mac os')) os = ' · macOS';
  else if (s.includes('linux')) os = ' · Linux';
  else if (s.includes('android')) os = '';
  else if (s.includes('iphone') || s.includes('ipad')) os = ' · iOS';
  return `${browser} en ${device}${os}`;
}

const fmt = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const Sessions = () => {
  const confirm = useConfirm();
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/sessions')
      .then(r => setRows(r.data.rows))
      .catch(err => toast.error(err.response?.data?.error || 'Error al cargar sesiones'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const revoke = async (id) => {
    setBusyId(id);
    try {
      await api.delete(`/sessions/${id}`);
      toast.success('Sesión cerrada');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cerrar la sesión');
    } finally {
      setBusyId(null);
    }
  };

  const revokeOthers = async () => {
    const ok = await confirm({
      title: 'Cerrar otras sesiones',
      message: 'Se cierran TODAS las sesiones activas excepto la actual.',
      confirmText: 'Cerrar todas',
      dangerous: true,
    });
    if (!ok) return;
    setBusyId('others');
    try {
      await api.post('/sessions/revoke-others');
      toast.success('Otras sesiones cerradas');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error');
    } finally {
      setBusyId(null);
    }
  };

  const active = rows.filter(r => r.is_active);
  const hasOthers = active.filter(r => !r.is_current).length > 0;

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Sesiones activas</h1>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
          Cada vez que iniciás sesión en un dispositivo se registra acá. Si ves alguna que no reconocés, cerrala.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand" />
          </div>
        ) : active.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-sm" style={{ color: '#6B7280' }}>No hay sesiones activas registradas.</p>
            <p className="text-xs mt-2" style={{ color: '#4B5563' }}>
              (Las sesiones se empiezan a trackear desde el primer login después de este feature.)
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {active.map(s => (
                <div key={s.id} className="card flex items-start gap-3"
                     style={s.is_current ? { borderColor: 'rgba(201,151,77,0.5)' } : {}}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{describeUA(s.user_agent)}</p>
                      {s.is_current && (
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded"
                              style={{ background: 'rgba(201,151,77,0.15)', color: '#C9974D', border: '1px solid rgba(201,151,77,0.4)' }}>
                          Esta sesión
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1 font-mono" style={{ color: '#6B7280' }}>
                      IP {s.ip || '—'}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: '#4B5563' }}>
                      Iniciada: {fmt(s.created_at)} · Última actividad: {fmt(s.last_seen_at)}
                    </p>
                  </div>
                  {!s.is_current && (
                    <button onClick={() => revoke(s.id)}
                            disabled={busyId === s.id}
                            className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-40"
                            style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#FCA5A5' }}>
                      {busyId === s.id ? '...' : 'Cerrar'}
                    </button>
                  )}
                </div>
              ))}
            </div>

            {hasOthers && (
              <button onClick={revokeOthers}
                      disabled={busyId === 'others'}
                      className="btn-secondary w-full py-2.5 text-sm disabled:opacity-40"
                      style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#FCA5A5' }}>
                {busyId === 'others' ? 'Cerrando...' : 'Cerrar todas las demás sesiones'}
              </button>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default Sessions;
