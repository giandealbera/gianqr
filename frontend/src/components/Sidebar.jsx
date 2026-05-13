import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = {
  admin: [
    { to: '/admin',          label: '📊 Dashboard'   },
    { to: '/admin/eventos',  label: '🎉 Eventos'     },
    { to: '/admin/usuarios', label: '👥 Usuarios'    },
    { to: '/admin/reportes', label: '💰 Reportes'    },
  ],
  cajero: [
    { to: '/caja', label: '🎫 Vender Entradas' },
  ],
  portero: [
    { to: '/escaner', label: '📷 Escanear QR' },
  ],
  promotor: [
    { to: '/promotor', label: '🔗 Mi Panel' },
  ],
};

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const items = navItems[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="w-60 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <span className="text-2xl font-black text-brand">GianQR</span>
        <p className="text-xs text-gray-500 mt-0.5">Sistema de Entradas</p>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Usuario */}
      <div className="px-4 py-4 border-t border-gray-800">
        <div className="text-sm font-medium text-gray-200">{user?.name}</div>
        <div className="text-xs text-gray-500 capitalize">{user?.role}</div>
        <button
          onClick={handleLogout}
          className="mt-3 text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
