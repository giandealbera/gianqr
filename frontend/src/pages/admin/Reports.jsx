import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import { exportCsv } from '../../utils/exportCsv';

/* ─── helpers ─────────────────────────────────────────────────────────── */
const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);
const METHOD_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', cortesia: 'Cortesía' };
const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const formatMonth = (mesStr) => {
  // mesStr = "2025-04"
  const [year, month] = mesStr.split('-');
  return `${MONTHS_ES[parseInt(month, 10) - 1]} ${year.slice(2)}`;
};

/* ─── Inline Bar Chart (sin dependencias) ─────────────────────────────── */
const BarChart = ({ data, series }) => {
  const maxVal = Math.max(
    ...data.flatMap(d => series.map(s => d[s.key] || 0)),
    1
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: `${Math.max(data.length * 72, 360)}px`, padding: '0 4px' }}>
        {/* Grid lines */}
        <div style={{ position: 'relative', paddingBottom: '36px' }}>
          {/* Horizontal grid */}
          {[0.25, 0.5, 0.75, 1].map(pct => (
            <div key={pct} style={{
              position: 'absolute', left: 0, right: 0,
              top: `${(1 - pct) * 100}%`,
              borderTop: '1px solid #1E2530',
              pointerEvents: 'none',
            }}>
              <span style={{ fontSize: '10px', color: '#374151', marginLeft: '4px', lineHeight: '1' }}>
                {Math.round(maxVal * pct)}
              </span>
            </div>
          ))}

          {/* Bars */}
          <div style={{
            display: 'flex', alignItems: 'flex-end',
            height: '180px', gap: '8px',
            paddingBottom: '0',
          }}>
            {data.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '100%', width: '100%', justifyContent: 'center' }}>
                  {series.map(s => {
                    const val = d[s.key] || 0;
                    const h = maxVal > 0 ? (val / maxVal) * 100 : 0;
                    return (
                      <div
                        key={s.key}
                        title={`${s.label}: ${val}`}
                        style={{
                          flex: 1,
                          height: `${Math.max(h, val > 0 ? 3 : 0)}%`,
                          background: s.gradient,
                          borderRadius: '4px 4px 0 0',
                          minHeight: val > 0 ? '4px' : '0',
                          cursor: 'default',
                          transition: 'opacity 0.15s',
                          maxWidth: '24px',
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* X labels */}
          <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', position: 'absolute', bottom: 0, left: 0, right: 0 }}>
            {data.map((d, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                {formatMonth(d.mes)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Legend pill ─────────────────────────────────────────────────────── */
const LegendPill = ({ color, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: color, flexShrink: 0 }} />
    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{label}</span>
  </div>
);

/* ─── Stat card ───────────────────────────────────────────────────────── */
const StatCard = ({ label, value, color, sub }) => (
  <div style={{
    background: '#0D1117', border: '1px solid #1E2530',
    borderRadius: '0.875rem', padding: '1.1rem 1.25rem',
  }}>
    <p style={{ fontSize: '11px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{label}</p>
    <p style={{ fontSize: '1.6rem', fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
    {sub && <p style={{ fontSize: '11px', color: '#4B5563', marginTop: '4px' }}>{sub}</p>}
  </div>
);

/* ─── Main component ──────────────────────────────────────────────────── */
const Reports = () => {
  const [events,   setEvents]   = useState([]);
  const [report,   setReport]   = useState(null);
  const [monthly,  setMonthly]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [filters,  setFilters]  = useState({ event_id: '', from: '', to: '', method: '' });
  const [tab, setTab] = useState('overview'); // 'overview' | 'detail'

  useEffect(() => {
    api.get('/events').then(r => setEvents(r.data));
    // Load monthly overview
    api.get('/payments/monthly-overview')
      .then(r => setMonthly(r.data.monthly || []))
      .catch(() => setMonthly([]))
      .finally(() => setLoadingMonthly(false));
    fetchReport();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.event_id) params.set('event_id', filters.event_id);
      if (filters.from)     params.set('from', filters.from);
      if (filters.to)       params.set('to', filters.to);
      const r = await api.get(`/payments/report?${params}`);
      setReport(r.data);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const filteredDetalle = useMemo(() => {
    if (!report?.detalle) return [];
    if (!filters.method) return report.detalle;
    return report.detalle.filter(t => t.payment_method === filters.method);
  }, [report, filters.method]);

  const resumen = useMemo(() => {
    if (!report) return [];
    if (!filters.method) return report.resumen;
    return report.resumen.filter(r => r.payment_method === filters.method);
  }, [report, filters.method]);

  const totalGeneral = useMemo(() => {
    if (!filters.method) return report?.total_general || 0;
    return filteredDetalle.reduce((acc, t) => acc + parseFloat(t.amount_paid || 0), 0);
  }, [report, filters.method, filteredDetalle]);

  // Totals from monthly
  const totalVendidas  = monthly.reduce((a, m) => a + m.vendidas, 0);
  const totalCortesias = monthly.reduce((a, m) => a + m.cortesias, 0);
  const totalFiestas   = monthly.reduce((a, m) => a + m.fiestas, 0);

  const handleExportCsv = () => {
    if (!filteredDetalle.length) return;
    exportCsv({
      filename: 'reporte-ventas',
      rows: filteredDetalle,
      columns: [
        { key: 'buyer_name',     label: 'Comprador' },
        { key: 'buyer_email',    label: 'Email' },
        { key: 'evento',         label: 'Evento' },
        { key: 'tipo_entrada',   label: 'Tipo' },
        { key: 'payment_method', label: 'Método', format: (v) => METHOD_LABEL[v] || v },
        { key: 'amount_paid',    label: 'Monto', format: (v) => parseFloat(v || 0).toFixed(2) },
        { key: 'created_at',     label: 'Fecha', format: (v) => v ? new Date(v).toISOString().slice(0, 19).replace('T', ' ') : '' },
      ],
    });
  };

  /* ─── Chart series config ─── */
  const chartSeries = [
    { key: 'vendidas',  label: 'Vendidas',  gradient: 'linear-gradient(to top, #A87B35, #C9974D)' },
    { key: 'cortesias', label: 'Regaladas', gradient: 'linear-gradient(to top, #1D4ED8, #60A5FA)' },
    { key: 'fiestas',   label: 'Fiestas',   gradient: 'linear-gradient(to top, #065F46, #34D399)' },
  ];

  return (
    <Layout>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem 1rem' }}>

        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#F1F5F9', lineHeight: 1.2 }}>Reportes</h1>
          <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>Resumen histórico del sistema de entradas</p>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: '4px',
          background: '#0D1117', border: '1px solid #1E2530',
          borderRadius: '0.75rem', padding: '4px', marginBottom: '1.5rem',
          width: 'fit-content',
        }}>
          {[
            { id: 'overview', label: '📊 Vista general' },
            { id: 'detail',   label: '📋 Detalle de ventas' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '7px 18px', borderRadius: '0.55rem', fontSize: '13px', fontWeight: 600,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: tab === t.id ? '#1E2530' : 'transparent',
                color: tab === t.id ? '#F1F5F9' : '#6B7280',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ══════════════ TAB: OVERVIEW ══════════════ */}
        {tab === 'overview' && (
          <>
            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
              <StatCard label="Entradas vendidas (12m)" value={totalVendidas.toLocaleString('es-AR')} color="#C9974D" sub="Pagadas y usadas" />
              <StatCard label="Regaladas (12m)"          value={totalCortesias.toLocaleString('es-AR')} color="#60A5FA" sub="Cortesías emitidas" />
              <StatCard label="Fiestas realizadas (12m)" value={totalFiestas.toLocaleString('es-AR')}   color="#34D399" sub="Eventos en el período" />
            </div>

            {/* Main chart */}
            <div style={{
              background: '#0D1117', border: '1px solid #1E2530',
              borderRadius: '0.875rem', padding: '1.5rem', marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#E2E8F0' }}>Actividad mes a mes</p>
                  <p style={{ fontSize: '11px', color: '#4B5563', marginTop: '2px' }}>Últimos 12 meses</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {chartSeries.map(s => (
                    <LegendPill key={s.key} color={s.gradient.includes('#C9974D') ? '#C9974D' : s.gradient.includes('#60A5FA') ? '#60A5FA' : '#34D399'} label={s.label} />
                  ))}
                </div>
              </div>

              {loadingMonthly ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand" />
                </div>
              ) : monthly.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#4B5563', fontSize: '13px' }}>
                  Sin datos disponibles aún
                </div>
              ) : (
                <BarChart data={monthly} series={chartSeries} />
              )}
            </div>

            {/* Mini breakdown per month table */}
            {monthly.length > 0 && (
              <div style={{
                background: '#0D1117', border: '1px solid #1E2530',
                borderRadius: '0.875rem', overflow: 'hidden',
              }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1E2530' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#E2E8F0' }}>Desglose mensual</p>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #1E2530' }}>
                        {['Mes', 'Vendidas', 'Regaladas', 'Total entradas', 'Fiestas'].map(h => (
                          <th key={h} style={{ padding: '10px 20px', textAlign: h === 'Mes' ? 'left' : 'right', color: '#4B5563', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...monthly].reverse().map((m, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #0D1117', transition: 'background 0.1s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#111827'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <td style={{ padding: '12px 20px', color: '#D1D5DB', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatMonth(m.mes)}</td>
                          <td style={{ padding: '12px 20px', textAlign: 'right', color: '#C9974D', fontWeight: 700 }}>{m.vendidas.toLocaleString('es-AR')}</td>
                          <td style={{ padding: '12px 20px', textAlign: 'right', color: '#60A5FA' }}>{m.cortesias.toLocaleString('es-AR')}</td>
                          <td style={{ padding: '12px 20px', textAlign: 'right', color: '#9CA3AF' }}>{(m.vendidas + m.cortesias).toLocaleString('es-AR')}</td>
                          <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              minWidth: '28px', background: m.fiestas > 0 ? 'rgba(52,211,153,0.1)' : 'transparent',
                              color: m.fiestas > 0 ? '#34D399' : '#374151',
                              fontWeight: 700, borderRadius: '6px', padding: '2px 8px',
                            }}>
                              {m.fiestas}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '1px solid #1E2530', background: '#111827' }}>
                        <td style={{ padding: '12px 20px', color: '#6B7280', fontWeight: 700, fontSize: '11px', textTransform: 'uppercase' }}>Total</td>
                        <td style={{ padding: '12px 20px', textAlign: 'right', color: '#C9974D', fontWeight: 900 }}>{totalVendidas.toLocaleString('es-AR')}</td>
                        <td style={{ padding: '12px 20px', textAlign: 'right', color: '#60A5FA', fontWeight: 900 }}>{totalCortesias.toLocaleString('es-AR')}</td>
                        <td style={{ padding: '12px 20px', textAlign: 'right', color: '#9CA3AF', fontWeight: 900 }}>{(totalVendidas + totalCortesias).toLocaleString('es-AR')}</td>
                        <td style={{ padding: '12px 20px', textAlign: 'right', color: '#34D399', fontWeight: 900 }}>{totalFiestas}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════ TAB: DETAIL ══════════════ */}
        {tab === 'detail' && (
          <>
            {/* Filters */}
            <div style={{
              background: '#0D1117', border: '1px solid #1E2530',
              borderRadius: '0.875rem', padding: '1.25rem', marginBottom: '1.25rem',
            }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Filtros</p>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Evento</label>
                  <select className="input" value={filters.event_id}
                    onChange={e => setFilters(f => ({ ...f, event_id: e.target.value }))}>
                    <option value="">Todos</option>
                    {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
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
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Método</label>
                  <select className="input" value={filters.method}
                    onChange={e => setFilters(f => ({ ...f, method: e.target.value }))}>
                    <option value="">Todos</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="cortesia">Cortesía</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={fetchReport} className="btn-primary w-full">Buscar</button>
                </div>
              </div>
            </div>

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand" />
              </div>
            )}

            {report && !loading && (
              <>
                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '1.25rem' }}>
                  {resumen.map(r => (
                    <div key={r.payment_method} style={{
                      background: '#0D1117', border: '1px solid #1E2530',
                      borderRadius: '0.875rem', padding: '1rem 1.25rem',
                    }}>
                      <p style={{ fontSize: '11px', color: '#6B7280', marginBottom: '6px' }}>{METHOD_LABEL[r.payment_method] || r.payment_method}</p>
                      <p style={{ fontSize: '1.4rem', fontWeight: 900, color: '#F1F5F9' }}>{fmt(r.total)}</p>
                      <p style={{ fontSize: '11px', color: '#4B5563', marginTop: '4px' }}>{r.cantidad} entradas</p>
                    </div>
                  ))}
                  <div style={{
                    background: 'linear-gradient(135deg, #0D1117, #111827)',
                    border: '1px solid rgba(201,151,77,0.35)',
                    borderRadius: '0.875rem', padding: '1rem 1.25rem',
                  }}>
                    <p style={{ fontSize: '11px', color: '#6B7280', marginBottom: '6px' }}>Total recaudado</p>
                    <p style={{ fontSize: '1.4rem', fontWeight: 900, color: '#C9974D' }}>{fmt(totalGeneral)}</p>
                    <p style={{ fontSize: '11px', color: '#4B5563', marginTop: '4px' }}>{filteredDetalle.length} entradas</p>
                  </div>
                </div>

                {/* Export */}
                {filteredDetalle.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '12px' }}>
                    <button onClick={handleExportCsv} className="btn-secondary text-xs">📥 Exportar CSV</button>
                    <button onClick={() => window.print()} className="btn-secondary text-xs">🖨️ Imprimir</button>
                  </div>
                )}

                {/* Table */}
                <div style={{
                  background: '#0D1117', border: '1px solid #1E2530',
                  borderRadius: '0.875rem', overflow: 'hidden',
                }}>
                  <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #1E2530' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#E2E8F0' }}>Detalle de ventas</p>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #1E2530' }}>
                          {['Comprador', 'Evento', 'Tipo', 'Método', 'Monto', 'Fecha'].map((h, i) => (
                            <th key={h} style={{
                              padding: '10px 16px',
                              textAlign: i >= 4 ? 'right' : 'left',
                              color: '#4B5563', fontWeight: 600, fontSize: '11px',
                              textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDetalle.map(t => (
                          <tr key={t.id}
                            style={{ borderBottom: '1px solid #111827', transition: 'background 0.1s' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#111827'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '11px 16px' }}>
                              <div style={{ fontWeight: 600, color: '#E2E8F0' }}>{t.buyer_name}</div>
                              <div style={{ fontSize: '11px', color: '#4B5563' }}>{t.buyer_email}</div>
                            </td>
                            <td style={{ padding: '11px 16px', color: '#9CA3AF', fontSize: '12px' }}>{t.evento}</td>
                            <td style={{ padding: '11px 16px', color: '#9CA3AF', fontSize: '12px' }}>{t.tipo_entrada}</td>
                            <td style={{ padding: '11px 16px' }}>
                              <span style={{
                                fontSize: '11px', fontWeight: 600,
                                padding: '3px 8px', borderRadius: '5px',
                                background: t.payment_method === 'cortesia'
                                  ? 'rgba(96,165,250,0.1)' : 'rgba(201,151,77,0.08)',
                                color: t.payment_method === 'cortesia' ? '#60A5FA' : '#C9974D',
                              }}>
                                {METHOD_LABEL[t.payment_method] || t.payment_method}
                              </span>
                            </td>
                            <td style={{ padding: '11px 16px', textAlign: 'right', color: '#34D399', fontWeight: 700 }}>
                              {fmt(t.amount_paid)}
                            </td>
                            <td style={{ padding: '11px 16px', textAlign: 'right', color: '#6B7280', fontSize: '12px', whiteSpace: 'nowrap' }}>
                              {new Date(t.created_at).toLocaleDateString('es-AR')}
                            </td>
                          </tr>
                        ))}
                        {filteredDetalle.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#4B5563' }}>
                              Sin resultados para los filtros aplicados
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default Reports;
