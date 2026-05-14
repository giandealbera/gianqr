import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

const MenuItem = ({ icon, label, desc, onClick }) => (
  <button
    onClick={onClick}
    className="w-full card flex items-center gap-4 hover:border-gray-700 transition-all active:scale-[0.98] text-left"
  >
    <span className="text-2xl">{icon}</span>
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
              <MenuItem icon="👥" label="Administrar personal" desc="Usuarios, roles y permisos" onClick={() => navigate('/admin/usuarios')} />
              <MenuItem icon="💰" label="Reportes de ventas" desc="Resumen financiero general" onClick={() => navigate('/admin/reportes')} />
              <MenuItem icon="📊" label="Dashboard general" desc="Vista global del sistema" onClick={() => navigate('/admin')} />
            </>
          )}
          
          <div className="pt-4 border-t border-gray-800 mt-4">
            <MenuItem icon="📱" label="Acerca de GianQR" desc="v1.0 — Sistema de entradas con QR" onClick={() => {}} />
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
