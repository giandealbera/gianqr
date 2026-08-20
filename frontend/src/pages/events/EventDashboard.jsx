import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { setActiveEvent } from '../../lib/activeEvent';
import { porcentaje, anchoBarra } from '../../lib/percent';
import toast from 'react-hot-toast';

const SvgIcon = ({ path, size = 'w-5 h-5' }) => (
  <svg className={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const ICONS = {
  gear:       'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  tag:        'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z',
  ticket:     'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
  qr:         'M3 9V6a1 1 0 011-1h3M3 15v3a1 1 0 001 1h3m11-4v3a1 1 0 01-1 1h-3m4-11h-3a1 1 0 01-1-1V3',
  list:       'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  users:      'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0zm6-3a3 3 0 11-6 0 3 3 0 016 0z',
  chart:      'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  chevron:    'M9 5l7 7-7 7',
  back:       'M10 19l-7-7m0 0l7-7m-7 7h18',
  ticket_gen: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8H4a1 1 0 00-1 1v10a1 1 0 001 1h3m5-18v4M7 16H3',
  calendar:   'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  location:   'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  lock:       'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  key:        'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
  trash:      'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  plus:       'M12 4v16m8-8H4',
};

const EventDashboard = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [event, setEvent]   = useState(null);
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOwnersModal, setShowOwnersModal] = useState(false);
  useBodyScrollLock(showOwnersModal);
  const [owners, setOwners]     = useState([]);
  const [allOwners, setAllOwners] = useState([]); // usuarios con rol owner
  const [addingOwner, setAddingOwner] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [evRes, statsRes] = await Promise.all([
          api.get(`/events/${id}`),
          api.get(`/events/${id}/stats`).catch(() => ({ data: null })),
        ]);
        setEvent(evRes.data);
        setStats(statsRes.data);
        // Recordar este evento como "activo" para el acceso directo (FAB).
        setActiveEvent(evRes.data.id, evRes.data.name);
      } catch {
        toast.error('Evento no encontrado');
        navigate('/eventos');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Cargar owners y usuarios con rol owner cuando el modal se abre (solo admin)
  useEffect(() => {
    if (!showOwnersModal || user?.role !== 'admin') return;
    api.get(`/events/${id}/owners`).then(r => setOwners(r.data)).catch(() => {});
    api.get('/users').then(r => setAllOwners(r.data.filter(u => u.role === 'owner' && u.is_active))).catch(() => {});
  }, [showOwnersModal, id]);

  if (loading) return (
    <Layout>
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand" />
      </div>
    </Layout>
  );

  if (!event) return null;

  const today     = new Date().toISOString().split('T')[0];
  const isActive  = event.is_active && event.date >= today;
  // Number() explicito: Postgres devuelve los COUNT como texto, asi que sumar
  // dos conteos sin convertir los CONCATENA. Mostraba "16450 vendidas" cuando
  // eran 164 escaneadas + 50 pendientes = 214. En SQLite vienen como numero,
  // por eso no se veia en desarrollo.
  const num = (v) => Number(v) || 0;
  const totalUsed = num(stats?.totals?.total_usados);
  // total_pagados cuenta SOLO las que todavia no se escanearon: al escanear,
  // la entrada pasa de 'pagado' a 'usado' y sale de ese conteo. Usarlo como
  // denominador daba porcentajes disparatados (con 9 de 10 escaneadas:
  // 9/1 = 900%, y la barra se salia de la pantalla). El total de entradas
  // validas es escaneadas + sin escanear, igual que hace LiveControl.
  const totalSold = (totalUsed + num(stats?.totals?.total_pagados)) || num(event.tickets_sold);
  const totalPend = num(stats?.totals?.total_pendientes);
  const checkinPct = porcentaje(totalUsed, totalSold);
  const salesStopped = !!event.sales_stopped_at;
  const canManageSales = ['admin','owner'].includes(user?.role);
  // Jefes y vendedores NO ven stats agregadas del evento (cuanta gente
  // hay, cuantas escaneadas, cupos por tipo). El dueño es el unico que
  // ve el panorama completo. Estos roles igual ven los tipos de entrada
  // para vender, pero sin counters.
  const canSeeStats = ['admin','owner'].includes(user?.role);

  const stopSales = async () => {
    const ok = await confirm({
      title: 'Cortar venta de entradas',
      message: 'Nadie va a poder comprar más. Podés reanudar cuando quieras; el evento sigue accesible para rendir y escanear.',
      confirmText: 'Cortar venta',
      dangerous: true,
    });
    if (!ok) return;
    try {
      await api.post(`/events/${id}/stop-sales`);
      toast.success('Venta cortada');
      const r = await api.get(`/events/${id}`); setEvent(r.data);
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo cortar'); }
  };
  const resumeSales = async () => {
    try {
      await api.post(`/events/${id}/resume-sales`);
      toast.success('Venta reanudada');
      const r = await api.get(`/events/${id}`); setEvent(r.data);
    } catch (e) { toast.error(e.response?.data?.error || 'No se pudo reanudar'); }
  };

  // Tools: admin/owner ven todo; jefe/vendedor solo lo operativo (configurar
  // ya esta restringido por permisos backend, pero igual lo dejamos visible
  // — al apretarlo recibirian 403). Lo que NO deben ver: Entradas vendidas
  // (lista de quien compro) ni Analíticas (graficos de venta), porque eso
  // revela cuanta gente hay y cuantos escanearon.
  // Herramientas de gestion del evento: configurar, tipos de entrada y
  // control de ingreso. Son solo para admin/owner.
  //
  // Al vendedor y al jefe se les mostraban igual, pero las tres terminaban en
  // un rechazo: PUT /events/:id pide admin u owner, y las pantallas de tipos
  // y de escaner tienen el mismo filtro de rol. O sea, tres botones que solo
  // servian para chocarse contra un "no tenés permiso".
  const canManageEvent = ['admin', 'owner'].includes(user?.role);

  const TOOLS = [
    ...(canManageEvent ? [
      { iconKey: 'gear',   label: 'Configurar evento',    sub: 'Editar datos y ajustes',      to: `/eventos?edit=${id}`,     disabled: false },
      { iconKey: 'tag',    label: 'Tipos de entrada',     sub: 'Precios y cupos disponibles', to: `/evento/${id}/tipos`,     disabled: false },
      { iconKey: 'qr',     label: 'Gestión del ingreso',  sub: 'Escáner y control de acceso', to: '/escaner',                disabled: false },
    ] : []),
    // Entradas vendidas y Analíticas: solo admin/owner. Revelan stats.
    ...(canSeeStats ? [
      { iconKey: 'list',  label: 'Entradas vendidas',   sub: 'Historial de tickets',        to: `/evento/${id}/vendidas`,  disabled: false },
      { iconKey: 'chart', label: 'Analíticas',          sub: 'Gráficos y métricas',         to: `/evento/${id}/stats`,     disabled: false },
    ] : []),
    { iconKey: 'ticket', label: 'Descuentos',           sub: 'Códigos y promociones',       to: null,                      disabled: true  },
    // Personal: solo admin
    ...(user?.role !== 'owner' && user?.role !== 'jefe_publicas' && user?.role !== 'vendedor'
        ? [{ iconKey: 'users', label: 'Personal', sub: 'Usuarios y permisos', to: '/admin/usuarios', disabled: false }] : []),
    // Dueños del evento: solo admin
    ...(user?.role === 'admin' ? [{ iconKey: 'key', label: 'Dueños del evento', sub: 'Asignar acceso de dueño', to: null, onClick: () => setShowOwnersModal(true), disabled: false }] : []),
  ];

  return (
    <>
    <Layout>
      <div className="px-4 lg:px-6 py-6 max-w-5xl mx-auto">

        {/* Back */}
        <button
          onClick={() => navigate('/eventos')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 mb-6 transition-colors group"
        >
          <SvgIcon path={ICONS.back} size="w-4 h-4" />
          <span className="group-hover:underline underline-offset-2">Mis eventos</span>
        </button>

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* ──────────── LEFT COLUMN (span 2) ──────────── */}
          <div className="md:col-span-2 flex flex-col gap-5">

            {/* Event Header Card */}
            <div style={{
              background: '#171A19',
              border: '1px solid #2B312E',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold font-heading text-[#E1E5E2] leading-tight truncate">{event.name}</h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                    <span className="flex items-center gap-1.5 text-sm" style={{ color: '#8C948D' }}>
                      <SvgIcon path={ICONS.calendar} size="w-3.5 h-3.5" />
                      {new Date(event.date + 'T12:00:00').toLocaleDateString('es-AR', {
                        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                      })}
                      {event.start_time && ` · ${event.start_time.slice(0, 5)} hs`}
                    </span>
                  </div>
                </div>

                {/* Status badge + corte venta */}
                <div className="flex items-center gap-2 shrink-0">
                  {salesStopped && (
                    <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded"
                         style={{ background: '#2B1D1E', color: '#D47779', border: '1px solid #45292B' }}>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                      </svg>
                      Venta cortada
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded"
                       style={isActive
                         ? { background: '#1C2920', color: '#78B884', border: '1px solid #2A4232' }
                         : { background: '#202422', color: '#8C948D', border: '1px solid #2B312E' }}>
                    {isActive && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#78B884] opacity-60" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#78B884]" />
                      </span>
                    )}
                    {isActive ? 'Activo' : 'Finalizado'}
                  </div>
                  {canManageSales && (
                    salesStopped ? (
                      <button onClick={resumeSales} className="btn-secondary text-xs py-1 px-2.5" title="Volver a abrir la venta">
                        Reanudar venta
                      </button>
                    ) : (
                      <button onClick={stopSales}
                        className="text-xs py-1 px-2.5 rounded font-medium border transition-colors"
                        style={{ background: '#2B1D1E', color: '#D47779', borderColor: '#45292B' }}
                        title="Sold out o querés cortar — el evento sigue accesible para rendir">
                        Cortar venta
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Stats Row — solo admin/owner ven los counters agregados */}
            {canSeeStats && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Vendidas',   value: totalSold, color: '#B59E7D', bg: '#202422', border: '#2B312E' },
                { label: 'Ingresaron', value: totalUsed, color: '#78B884', bg: '#1C2920', border: '#2A4232' },
                { label: 'Pendientes', value: totalPend, color: '#D4B475', bg: '#2B261D', border: '#42392A' },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} style={{
                  background: bg,
                  border: `1px solid ${border}`,
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  textAlign: 'center',
                }}>
                  <p className="text-3xl font-bold font-mono" style={{ color }}>{value}</p>
                  <p className="text-[10px] uppercase tracking-wider mt-1.5" style={{ color: '#8C948D' }}>{label}</p>
                </div>
              ))}
            </div>
            )}

            {/* Check-in Progress — solo admin/owner */}
            {canSeeStats && (
            <div style={{
              background: '#0D1117',
              border: '1px solid #1E2530',
              borderRadius: '0.875rem',
              padding: '1.25rem',
            }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-200">Check-in del evento</p>
                  <p className="text-xs text-gray-500 mt-0.5">{totalUsed} de {totalSold} entradas escaneadas</p>
                </div>
                <span className="text-2xl font-black" style={{ color: checkinPct >= 80 ? '#34D399' : checkinPct >= 40 ? '#C9974D' : '#60A5FA' }}>
                  {checkinPct}%
                </span>
              </div>
              <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: '#1E2530' }}>
                <div
                  className="h-2 rounded-full transition-all duration-700"
                  style={{
                    width: anchoBarra(checkinPct, 1),
                    background: checkinPct >= 80
                      ? 'linear-gradient(90deg, #059669, #34D399)'
                      : checkinPct >= 40
                      ? 'linear-gradient(90deg, #A87B35, #C9974D)'
                      : 'linear-gradient(90deg, #2563EB, #60A5FA)',
                  }}
                />
              </div>
            </div>
            )}

            {/* Ticket type breakdown — solo admin/owner (los counters revelan venta) */}
            {canSeeStats && stats?.by_type?.length > 0 && (
              <div style={{
                background: '#0D1117',
                border: '1px solid #1E2530',
                borderRadius: '0.875rem',
                padding: '1.25rem',
              }}>
                <h3 className="text-sm font-semibold text-gray-200 mb-4">Tipos de entrada</h3>
                <div className="space-y-4">
                  {stats.by_type.map((tt, i) => {
                    const pct = porcentaje(tt.sold_count, tt.total_quota);
                    const barColor = pct >= 90 ? '#EF4444' : pct >= 50 ? '#FBBF24' : '#C9974D';
                    return (
                      <div key={i}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-sm text-gray-300 font-medium">{tt.tipo}</span>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{tt.sold_count}/{tt.total_quota}</span>
                            <span className="font-semibold" style={{ color: barColor }}>{pct}%</span>
                          </div>
                        </div>
                        <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: '#1E2530' }}>
                          <div
                            className="h-1.5 rounded-full transition-all duration-500"
                            style={{ width: anchoBarra(pct, 1), background: barColor }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1">{tt.disponibles} disponibles</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ──────────── RIGHT COLUMN ──────────── */}
          <div className="flex flex-col gap-4">

            {/* Primary CTA - Generate tickets */}
            <Link
              to={`/caja?event=${id}`}
              style={{
                display: 'block',
                background: 'linear-gradient(135deg, #111827 0%, #1a1f2e 100%)',
                border: '1px solid rgba(201,151,77,0.4)',
                borderRadius: '0.875rem',
                padding: '1.1rem 1.25rem',
                textDecoration: 'none',
                boxShadow: '0 0 20px rgba(201,151,77,0.06)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(201,151,77,0.7)';
                e.currentTarget.style.boxShadow = '0 0 28px rgba(201,151,77,0.14)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(201,151,77,0.4)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(201,151,77,0.06)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div className="flex items-center gap-3">
                <div style={{
                  width: '38px', height: '38px', borderRadius: '0.6rem', flexShrink: 0,
                  background: 'rgba(201,151,77,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <SvgIcon path={ICONS.ticket} size="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">Generar entradas</p>
                  <p className="text-xs text-gray-500 mt-0.5">Ir a la caja de venta</p>
                </div>
                <SvgIcon path={ICONS.chevron} size="w-4 h-4" />
              </div>
            </Link>

            {/* Operations panel */}
            <div style={{
              background: '#0D1117',
              border: '1px solid #1E2530',
              borderRadius: '0.875rem',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '1rem 1.25rem 0.75rem', borderBottom: '1px solid #1E2530' }}>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Herramientas</p>
              </div>

              <div>
                {TOOLS.map((tool, idx) => {
                  const { iconKey, label, sub, to, disabled, onClick } = tool;
                  const inner = (
                    <div
                      key={label}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.875rem',
                        padding: '0.85rem 1.25rem',
                        borderBottom: idx < TOOLS.length - 1 ? '1px solid #141920' : 'none',
                        opacity: disabled ? 0.38 : 1,
                        transition: 'background 0.15s',
                        cursor: disabled ? 'default' : 'pointer',
                      }}
                      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#111827'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ color: disabled ? '#4B5563' : '#C9974D', flexShrink: 0 }}>
                        <SvgIcon path={ICONS[iconKey]} size="w-4 h-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200 leading-tight">{label}</p>
                        <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {disabled && (
                          <span style={{
                            fontSize: '9px', fontWeight: 700,
                            letterSpacing: '0.06em', textTransform: 'uppercase',
                            color: '#6B7280', background: '#1E2530',
                            padding: '2px 6px', borderRadius: '4px',
                          }}>Pronto</span>
                        )}
                        {!disabled && (
                          <span style={{ color: '#374151' }}>
                            <SvgIcon path={ICONS.chevron} size="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </div>
                  );

                  if (disabled || (!to && !onClick)) return <div key={label}>{inner}</div>;
                  if (onClick) return <div key={label} onClick={onClick} style={{ cursor: 'pointer' }}>{inner}</div>;
                  return (
                    <Link key={label} to={to} style={{ textDecoration: 'none', display: 'block' }}>
                      {inner}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>

    {/* Modal gestión de dueños */}
    {showOwnersModal && user?.role === 'admin' && (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        }}
        onClick={e => { if (e.target === e.currentTarget) setShowOwnersModal(false); }}
      >
        <div style={{
          background: '#0D1117', border: '1px solid #1E2530',
          borderRadius: '1rem', width: '100%', maxWidth: '480px',
          padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <p style={{ fontWeight: 800, color: '#F1F5F9', fontSize: '15px' }}>Dueños del evento</p>
              <p style={{ fontSize: '12px', color: '#4B5563', marginTop: '2px' }}>{event?.name}</p>
            </div>
            <button onClick={() => setShowOwnersModal(false)}
              style={{ background: '#1E2530', border: 'none', borderRadius: '8px', padding: '6px 10px', color: '#9CA3AF', cursor: 'pointer', fontSize: '14px' }}
            >✕</button>
          </div>

          {/* Lista de owners asignados */}
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Asignados actualmente</p>
            {owners.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#374151', padding: '12px 0' }}>Sin dueños asignados aún</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {owners.map(o => (
                  <div key={o.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#111827', borderRadius: '8px', padding: '10px 12px',
                  }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#E2E8F0' }}>{o.name} {o.apellido || ''}</p>
                      <p style={{ fontSize: '11px', color: '#4B5563' }}>{o.email}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await api.delete(`/events/${id}/owners/${o.id}`);
                        setOwners(prev => prev.filter(x => x.id !== o.id));
                        toast.success('Dueño removido');
                      }}
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '4px 8px', color: '#EF4444', cursor: 'pointer', fontSize: '11px' }}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Agregar owner */}
          <div style={{ borderTop: '1px solid #1E2530', paddingTop: '1rem' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Asignar dueño</p>
            {allOwners.filter(u => !owners.find(o => o.id === u.id)).length === 0 ? (
              <p style={{ fontSize: '12px', color: '#374151' }}>No hay usuarios con rol Dueño disponibles. Crea uno en <a href="/admin/usuarios" style={{ color: '#C9974D' }}>Usuarios</a>.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {allOwners.filter(u => !owners.find(o => o.id === u.id)).map(u => (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#111827', borderRadius: '8px', padding: '10px 12px',
                  }}>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#E2E8F0' }}>{u.name} {u.apellido || ''}</p>
                      <p style={{ fontSize: '11px', color: '#4B5563' }}>{u.email}</p>
                    </div>
                    <button
                      disabled={addingOwner}
                      onClick={async () => {
                        setAddingOwner(true);
                        try {
                          await api.post(`/events/${id}/owners`, { user_id: u.id });
                          setOwners(prev => [...prev, u]);
                          toast.success(`${u.name} asignado como dueño`);
                        } catch(err) {
                          toast.error(err.response?.data?.error || 'Error al asignar');
                        } finally {
                          setAddingOwner(false);
                        }
                      }}
                      style={{ background: 'rgba(201,151,77,0.1)', border: '1px solid rgba(201,151,77,0.3)', borderRadius: '6px', padding: '4px 8px', color: '#C9974D', cursor: 'pointer', fontSize: '11px' }}
                    >
                      + Asignar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
  </>
  );
};

export default EventDashboard;
