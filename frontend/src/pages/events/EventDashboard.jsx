import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);

const SvgIcon = ({ path }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const ICON_PATHS = {
  gear:    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  tag:     'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z',
  ticket:  'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
  qr:      'M3 9V6a1 1 0 011-1h3M3 15v3a1 1 0 001 1h3m11-4v3a1 1 0 01-1 1h-3m4-11h-3a1 1 0 01-1-1V3',
  money:   'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  users:   'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0zm6-3a3 3 0 11-6 0 3 3 0 016 0z',
};

const ActionCard = ({ iconKey, label, onClick, to, disabled }) => {
  const cls = `flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-gray-800 bg-gray-900 hover:border-brand/40 hover:bg-gray-800/50 transition-all cursor-pointer active:scale-95 ${disabled ? 'opacity-40 pointer-events-none' : ''}`;
  const inner = (
    <>
      <span style={{ color: '#C9974D' }}><SvgIcon path={ICON_PATHS[iconKey]} /></span>
      <span className="text-xs text-gray-300 text-center leading-tight font-medium">{label}</span>
    </>
  );
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  return <button onClick={onClick} className={cls}>{inner}</button>;
};

const EventDashboard = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [evRes, statsRes, ticketsRes] = await Promise.all([
          api.get(`/events/${id}`),
          api.get(`/events/${id}/stats`).catch(() => ({ data: null })),
          api.get(`/tickets?event_id=${id}`).catch(() => ({ data: [] })),
        ]);
        setEvent(evRes.data);
        setStats(statsRes.data);
        setTickets(ticketsRes.data);
      } catch {
        toast.error('Evento no encontrado');
        navigate('/eventos');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return (
    <Layout>
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand" />
      </div>
    </Layout>
  );

  if (!event) return null;

  const today = new Date().toISOString().split('T')[0];
  const isActive = event.is_active && event.date >= today;
  const totalSold = stats?.totals?.total_pagados || event.tickets_sold || 0;
  const totalUsed = stats?.totals?.total_usados || 0;
  const totalRevenue = stats?.totals?.total_recaudado || 0;
  
  // Today's sales
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = tickets.filter(t => t.created_at?.startsWith(todayStr) && t.status === 'pagado');
  const todayRevenue = todaySales.reduce((acc, t) => acc + parseFloat(t.amount_paid || 0), 0);

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-3xl mx-auto lg:max-w-4xl">
        {/* Back + Event header */}
        <button onClick={() => navigate('/eventos')} className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1 transition-colors">
          ← Mis eventos
        </button>

        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">{event.name}</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {new Date(event.date + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {event.start_time && ` · ${event.start_time.slice(0, 5)} hs`}
              </p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
              isActive ? 'bg-emerald-900/60 text-emerald-400' : 'bg-gray-700 text-gray-400'
            }`}>
              {isActive ? 'Activo' : 'Finalizado'}
            </span>
          </div>
          {event.venue_name && (
            <p className="text-xs text-gray-500 mt-1">📍 {event.venue_name}</p>
          )}
        </div>

        {/* Main CTA buttons */}
        <div className="space-y-3 mb-6">
          <Link
            to={`/caja?event=${id}`}
            className="block w-full bg-gradient-to-r from-brand to-pink-600 text-white font-semibold py-3.5 rounded-xl text-center hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            🎫 Generar entradas
          </Link>
          <Link
            to={`/evento/${id}/vendidas`}
            className="block w-full bg-gray-900 border border-gray-800 text-white font-medium py-3 rounded-xl text-center hover:border-gray-700 transition-colors active:scale-[0.98]"
          >
            📋 Entradas vendidas
          </Link>
          <Link
            to={`/evento/${id}/stats`}
            className="block w-full bg-gray-900 border border-gray-800 text-white font-medium py-3 rounded-xl text-center hover:border-gray-700 transition-colors active:scale-[0.98]"
          >
            📊 Datos y analíticas
          </Link>
        </div>

        {/* Sales summary card */}
        <div className="card mb-6 bg-gradient-to-br from-gray-900 to-gray-900/80 border-brand/20">
          <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-1">
            💰 Ventas
          </h3>
          <p className="text-3xl font-bold text-white mt-1">
            {fmt(totalRevenue)}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Hoy ({new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}): {fmt(todayRevenue)}
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-brand">{totalSold}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">Vendidas</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-blue-400">{totalUsed}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">Ingresaron</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-2xl font-bold text-yellow-400">{stats?.totals?.total_pendientes || 0}</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">Pendientes</p>
          </div>
        </div>

        {/* Action grid - like World Pass */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <ActionCard iconKey="gear"   label="Configurar evento" to={`/evento/${id}/config`} />
          <ActionCard iconKey="tag"    label="Tipos de entrada" to={`/evento/${id}/tipos`} />
          <ActionCard iconKey="ticket" label="Descuentos" to={`/evento/${id}/descuentos`} disabled />
          <ActionCard iconKey="qr"     label="Gestión del ingreso" to="/escaner" />
          <ActionCard iconKey="money"  label="Mis ventas" to={`/evento/${id}/vendidas`} />
          <ActionCard iconKey="users"  label="Personal" to="/admin/usuarios" />
        </div>

        {/* Ticket types breakdown */}
        {stats?.by_type?.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-sm mb-3">Desglose por tipo</h3>
            <div className="space-y-3">
              {stats.by_type.map((tt, i) => {
                const pct = tt.total_quota > 0 ? Math.round((tt.sold_count / tt.total_quota) * 100) : 0;
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-gray-300">{tt.tipo}</span>
                      <span className="text-xs text-gray-500">
                        {tt.sold_count}/{tt.total_quota} · {fmt(tt.recaudado)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-brand'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default EventDashboard;
