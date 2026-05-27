import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = {
  // Admin = SaaS operator. Solo ve cosas cross-tenant y agregadas. Lo
  // operativo de un evento (vender, escanear, cortesias, rendir) se
  // hace desde el panel del Dueño. Si necesita entrar por soporte, las
  // URLs siguen accesibles para admin pero no aparecen en el menu.
  admin: [
    { to: '/admin',           label: 'Dashboard'   },
    { to: '/eventos',         label: 'Eventos'     },
    { to: '/admin/usuarios',  label: 'Dueños'      },
    { to: '/admin/reportes',  label: 'Reportes'    },
    { to: '/admin/historial', label: 'Historial'   },
    { to: '/admin/bitacora',  label: 'Bitácora'    },
    { to: '/configuracion',   label: 'Configuracion' },
  ],
  jefe_publicas: [
    { to: '/eventos',  label: 'Eventos'  },
    { to: '/promotor', label: 'Mi Panel' },
  ],
  vendedor: [
    { to: '/eventos',  label: 'Eventos'  },
    { to: '/promotor', label: 'Mi Panel' },
  ],
  // Owner = cliente que compró el sistema. Tiene panel completo pero
  // SOLO ve datos de SUS eventos (event_owners).
  owner: [
    { to: '/eventos',           label: 'Mis Eventos'   },
    { to: '/caja',              label: 'Vender'        },
    { to: '/escaner',           label: 'Escaner'       },
    { to: '/admin/cortesias',   label: 'Cortesías'     },
    { to: '/admin/usuarios',    label: 'Mi Personal'   },
    { to: '/admin/promotores',  label: 'Mis Públicas'  },
    { to: '/admin/rendicion',   label: 'Rendición'     },
    { to: '/admin/control',     label: 'Control en vivo' },
    { to: '/admin/reportes',    label: 'Reportes'      },
    { to: '/admin/historial',   label: 'Historial'     },
    { to: '/admin/zonas',       label: 'Mis Zonas'     },
    { to: '/admin/proveedores', label: 'Proveedores'   },
    { to: '/admin/bitacora',    label: 'Bitácora'      },
    { to: '/configuracion',     label: 'Configuración' },
  ],
};

const ROLE_LABELS = {
  admin:         'Administrador',
  jefe_publicas: 'Jefe de Publicas',
  vendedor:      'Vendedor',
  owner:         'Dueño del evento',
};

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = navItems[user?.role] || [];

  return (
    <aside className="w-56 min-h-dvh flex flex-col" style={{ background: '#0D1117', borderRight: '1px solid #1E2530' }}>
      {/* Logo */}
      <div className="px-6 py-5" style={{ borderBottom: '1px solid #1E2530' }}>
        <span className="text-lg font-black tracking-tight" style={{ color: '#C9974D' }}>GianQR</span>
        <p className="text-xs mt-0.5" style={{ color: '#374151' }}>Sistema de Entradas</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin'}
            className={({ isActive }) =>
              `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'text-white'
                  : 'hover:text-gray-100'
              }`
            }
            style={({ isActive }) => isActive
              ? { background: 'linear-gradient(135deg, rgba(201,151,77,0.15), rgba(168,123,53,0.1))', color: '#C9974D', borderLeft: '2px solid #C9974D', paddingLeft: '10px' }
              : { color: '#6B7280' }
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid #1E2530' }}>
        <div className="text-sm font-semibold text-gray-200">{user?.name}</div>
        <div className="text-xs mt-0.5" style={{ color: '#4B5563' }}>{ROLE_LABELS[user?.role] || user?.role}</div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="mt-3 text-xs transition-colors"
          style={{ color: '#7F1D1D' }}
          onMouseEnter={e => e.target.style.color = '#EF4444'}
          onMouseLeave={e => e.target.style.color = '#7F1D1D'}
        >
          Cerrar sesion
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
