// Bitácora — visor del audit log para admin y owner.
//
// Muestra todas las acciones sensibles registradas: resets de password,
// cambios de rol, borrado de tickets, reset de eventos, login fallidos, etc.
// Filtros por accion + texto + rango de fechas. Click en una fila expande
// el detalle JSON.
//
// El backend ya scopea segun el rol: admin ve acciones de su sub-arbol,
// owner ve las suyas + las de su staff.

import { Fragment, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import toast from 'react-hot-toast';

// Etiquetas amigables para el codigo de accion. Si aparece una accion que
// no esta en este map, mostramos el codigo crudo. Asi agregar nuevas
// acciones en el backend no rompe la UI.
const ACTION_LABEL = {
  USER_CREATE:             { label: 'Usuario creado',           cat: 'user', tone: 'info' },
  USER_UPDATE:             { label: 'Usuario editado',          cat: 'user', tone: 'info' },
  USER_DEACTIVATE:         { label: 'Usuario desactivado',      cat: 'user', tone: 'warn' },
  USER_REACTIVATE:         { label: 'Usuario reactivado',       cat: 'user', tone: 'info' },
  USER_PASSWORD_RESET:     { label: 'Reset de password',        cat: 'user', tone: 'danger' },
  USER_ROLE_CHANGE:        { label: 'Cambio de rol',            cat: 'user', tone: 'danger' },
  USER_COMMISSION_CHANGE:  { label: 'Cambio de comisión',       cat: 'user', tone: 'warn' },
  USER_MAGIC_LINK:         { label: 'Magic link emitido',       cat: 'user', tone: 'info' },
  EVENT_CREATE:            { label: 'Evento creado',            cat: 'event', tone: 'info' },
  EVENT_UPDATE:            { label: 'Evento editado',           cat: 'event', tone: 'info' },
  EVENT_RESET:             { label: 'Evento reiniciado',        cat: 'event', tone: 'danger' },
  EVENT_OWNER_ADDED:       { label: 'Dueño asignado',           cat: 'event', tone: 'info' },
  EVENT_OWNER_REMOVED:     { label: 'Dueño removido',           cat: 'event', tone: 'warn' },
  TICKET_DELETE:           { label: 'Ticket eliminado',         cat: 'ticket', tone: 'danger' },
  AUTH_LOGIN_FAILED:       { label: 'Login fallido',            cat: 'auth', tone: 'warn' },
};

const TONE_STYLE = {
  info:   { bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.3)',  text: '#93C5FD' },
  warn:   { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.35)', text: '#FBBF24' },
  danger: { bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.40)',  text: '#FCA5A5' },
};

const PAGE_SIZE = 100;

const formatDate = (s) => {
  if (!s) return '';
  const d = new Date(s);
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const AuditLog = () => {
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [offset, setOffset]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', from: '', to: '', search: '' });
  const [expandedId, setExpandedId] = useState(null);

  const load = async (resetOffset = false) => {
    setLoading(true);
    const off = resetOffset ? 0 : offset;
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
      if (filters.action) params.set('action', filters.action);
      if (filters.from)   params.set('from',   filters.from);
      if (filters.to)     params.set('to',     filters.to);
      const r = await api.get(`/audit-log?${params.toString()}`);
      setRows(r.data.rows);
      setTotal(r.data.total);
      if (resetOffset) setOffset(0);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cargar la bitácora');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [offset]);

  // Filtro client-side adicional por texto (email del actor / resource_id).
  // Asi el usuario puede pinear una busqueda rapida sin re-hit al backend.
  const filteredRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.actor_email || '').toLowerCase().includes(q) ||
      (r.resource_id || '').toLowerCase().includes(q) ||
      (r.ip || '').toLowerCase().includes(q)
    );
  }, [rows, filters.search]);

  const actions = Object.entries(ACTION_LABEL);

  const pageStart = offset + 1;
  const pageEnd   = Math.min(offset + PAGE_SIZE, total);
  const canPrev   = offset > 0;
  const canNext   = offset + PAGE_SIZE < total;

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-1">
          <h1 className="text-2xl font-bold">Bitácora</h1>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            {total > 0 && !loading && `${pageStart}–${pageEnd} de ${total.toLocaleString('es-AR')}`}
          </p>
        </div>
        <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
          Registro de acciones sensibles del sistema. Solo lectura, no se puede editar ni borrar.
        </p>

        {/* Filtros */}
        <div className="card mb-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Acción</label>
              <select className="input" value={filters.action}
                      onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}>
                <option value="">Todas</option>
                {actions.map(([code, meta]) => (
                  <option key={code} value={code}>{meta.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Desde</label>
              <input type="date" className="input" value={filters.from}
                     onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Hasta</label>
              <input type="date" className="input" value={filters.to}
                     onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
            </div>
            <div className="flex items-end">
              <button onClick={() => load(true)} className="btn-primary w-full">Buscar</button>
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs text-gray-400 block mb-1">Filtro rápido (email, resource_id, IP)</label>
            <input className="input" placeholder="Filtrar resultados visibles"
                   value={filters.search}
                   onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          </div>
        </div>

        {/* Tabla */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-sm" style={{ color: '#6B7280' }}>
              {total === 0 ? 'Todavía no hay actividad registrada.' : 'Ningún resultado con esos filtros.'}
            </p>
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: '#161B24', borderBottom: '1px solid #1E2530' }}>
                  <tr style={{ color: '#6B7280' }}>
                    <th className="text-left px-3 py-2 font-medium">Fecha</th>
                    <th className="text-left px-3 py-2 font-medium">Quién</th>
                    <th className="text-left px-3 py-2 font-medium">Acción</th>
                    <th className="text-left px-3 py-2 font-medium">Sobre</th>
                    <th className="text-left px-3 py-2 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r) => {
                    const meta = ACTION_LABEL[r.action] || { label: r.action, tone: 'info' };
                    const tone = TONE_STYLE[meta.tone] || TONE_STYLE.info;
                    const isExpanded = expandedId === r.id;
                    return (
                      <Fragment key={r.id}>
                        <tr onClick={() => setExpandedId(isExpanded ? null : r.id)}
                            className="cursor-pointer hover:bg-gray-800/40 transition-colors"
                            style={{ borderTop: '1px solid #1E2530' }}>
                          <td className="px-3 py-2 font-mono text-xs" style={{ color: '#9CA3AF' }}>
                            {formatDate(r.created_at)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-xs">{r.actor_email || <span style={{ color: '#4B5563' }}>—</span>}</div>
                            <div className="text-[10px]" style={{ color: '#4B5563' }}>{r.actor_role || ''}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-block px-2 py-1 rounded text-xs font-medium"
                                  style={{ background: tone.bg, border: `1px solid ${tone.border}`, color: tone.text }}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px]" style={{ color: '#9CA3AF' }}>
                            {r.resource_type ? `${r.resource_type}:${(r.resource_id || '').slice(0,8)}` : ''}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px]" style={{ color: '#6B7280' }}>
                            {r.ip || ''}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ background: '#0B0F16', borderTop: '1px solid #1E2530' }}>
                            <td colSpan={5} className="px-4 py-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                <div>
                                  <p className="text-gray-500 uppercase tracking-wider text-[10px] mb-1">Detalle</p>
                                  <pre className="font-mono text-[11px] whitespace-pre-wrap p-2 rounded"
                                       style={{ background: '#161B24', border: '1px solid #1E2530', color: '#C9974D' }}>
                                    {r.details ? JSON.stringify(r.details, null, 2) : '(sin detalle)'}
                                  </pre>
                                </div>
                                <div className="space-y-2">
                                  <div>
                                    <p className="text-gray-500 uppercase tracking-wider text-[10px]">Resource ID completo</p>
                                    <p className="font-mono text-[11px] break-all" style={{ color: '#9CA3AF' }}>
                                      {r.resource_id || '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500 uppercase tracking-wider text-[10px]">User-Agent</p>
                                    <p className="text-[11px] break-all" style={{ color: '#9CA3AF' }}>
                                      {r.user_agent || '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500 uppercase tracking-wider text-[10px]">Actor user_id</p>
                                    <p className="font-mono text-[11px] break-all" style={{ color: '#9CA3AF' }}>
                                      {r.actor_user_id || '—'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Paginacion */}
        {(canPrev || canNext) && (
          <div className="flex items-center justify-between mt-4">
            <button onClick={() => canPrev && setOffset(Math.max(0, offset - PAGE_SIZE))}
                    disabled={!canPrev}
                    className="btn-secondary px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
              ← Anteriores
            </button>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              {pageStart}–{pageEnd} de {total.toLocaleString('es-AR')}
            </p>
            <button onClick={() => canNext && setOffset(offset + PAGE_SIZE)}
                    disabled={!canNext}
                    className="btn-secondary px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
              Siguientes →
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AuditLog;
