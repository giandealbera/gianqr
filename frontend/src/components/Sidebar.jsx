import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = {
  admin: [
    { to: '/admin',           label: 'Dashboard'      },
    { to: '/eventos',         label: 'Eventos'        },
    { to: '/caja',            label: 'Vender'         },
    { to: '/escaner',         label: 'Escaner'        },
    { to: '/admin/usuarios',  label: 'Usuarios'       },
    { to: '/admin/promotores',label: 'Publicas'       },
    { to: '/admin/reportes',  label: 'Reportes'       },
  ],
  cajero: [
    { to: '/eventos', label: 'Eventos' },
    { to: '/caja',    label: 'Vender'  },
  ],
  promotor: [
    { to: '/eventos',  label: 'Eventos'  },
    { to: '/promotor', label: 'Mi Panel' },
  ],
};

const ROLE_LABELS = {
  admin:         'Administrador',
  cajero:        'Cajero',
  promotor:      'Promotor',
  jefe_publicas: 'Jefe de Publicas',
  vendedor:      'Vendedor',
};

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = navItems[user?.role] || [];

  return (
    <aside className="w-56 min-h-screen bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="px-6 py-5 border-b border-slate-800">
        <span className="text-xl font-black text-brand tracking-tight">GianQR</span>
        <p className="text-xs text-slate-500 mt-0.5">Sistema de Entradas</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin'}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-slate-800">
        <div className="text-sm font-semibold text-slate-200">{user?.name}</div>
        <div className="text-xs text-slate-500 mt-0.5">{ROLE_LABELS[user?.role] || user?.role}</div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="mt-3 text-xs text-red-500 hover:text-red-400 transition-colors"
        >
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
