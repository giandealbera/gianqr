import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

const SvgIcon = ({ path }) => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const ICONS = {
  users:    'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-4a4 4 0 11-8 0 4 4 0 018 0zm6-3a3 3 0 11-6 0 3 3 0 016 0z',
  megaphone:'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  money:    'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  chart:    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  receipt:  'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  info:     'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  ticket:   'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z',
};

const MenuItem = ({ iconKey, label, desc, onClick }) => (
  <button
    onClick={onClick}
    className="w-full card flex items-center gap-4 hover:border-gray-700 transition-all active:scale-[0.98] text-left"
  >
    <span style={{ color: '#C9974D' }}><SvgIcon path={ICONS[iconKey]} /></span>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm text-white">{label}</p>
      {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
    </div>
    <span className="text-gray-600">›</span>
  </button>
);

const MoreMenu = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Más opciones</h1>

        {/* Profile card */}
        <div className="card flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-brand/20 flex items-center justify-center text-brand text-xl font-bold">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-white">{user?.name}</p>
            <p className="text-sm text-gray-400">{user?.email}</p>
            <p className="text-xs text-brand capitalize mt-0.5">{user?.role}</p>
          </div>
        </div>

        {/* Menu items */}
        <div className="space-y-2">
          {user?.role === 'admin' && (
            <>
              <MenuItem iconKey="users"     label="Administrar personal"  desc="Usuarios, roles y permisos" onClick={() => navigate('/admin/usuarios')} />
              <MenuItem iconKey="megaphone" label="Públicas y promotores" desc="Ventas y comisiones de promotores" onClick={() => navigate('/admin/promotores')} />
              <MenuItem iconKey="chart"     label="Control en vivo"       desc="Ingresos en tiempo real y listado de personas" onClick={() => navigate('/admin/control')} />
              <MenuItem iconKey="ticket"    label="Cortesias"             desc="Generar entradas sin costo" onClick={() => navigate('/admin/cortesias')} />
              <MenuItem iconKey="receipt"   label="Rendición de entradas" desc="Búsqueda de públicas y registro de pagos" onClick={() => navigate('/admin/rendicion')} />
              <MenuItem iconKey="money"     label="Reportes de ventas"    desc="Resumen financiero general" onClick={() => navigate('/admin/reportes')} />
              <MenuItem iconKey="chart"     label="Dashboard general"     desc="Vista global del sistema" onClick={() => navigate('/admin')} />
            </>
          )}

          <div className="pt-4 border-t border-gray-800 mt-4">
            <MenuItem iconKey="info" label="Acerca de GianQR" desc="v1.0 — Sistema de entradas con QR" onClick={() => {}} />
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full mt-8 py-3 rounded-xl border border-red-900/50 text-red-400 font-medium hover:bg-red-900/20 transition-colors active:scale-[0.98]"
        >
          Cerrar sesión
        </button>
      </div>
    </Layout>
  );
};

export default MoreMenu;
