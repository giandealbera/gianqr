import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const BottomNav = () => {
  const { user } = useAuth();
  const location = useLocation();

  const navMap = {
    admin: [
      { to: '/eventos',        icon: '📅', label: 'Eventos' },
      { to: '/caja',           icon: '🎫', label: 'Vender' },
      { to: '/escaner',        icon: '📷', label: 'Escanear' },
      { to: '/admin/reportes', icon: '💰', label: 'Reportes' },
      { to: '/mas',            icon: '⋯',  label: 'Más' },
    ],
    cajero: [
      { to: '/eventos',  icon: '📅', label: 'Eventos' },
      { to: '/caja',     icon: '🎫', label: 'Vender' },
      { to: '/mas',      icon: '⋯',  label: 'Más' },
    ],
    promotor: [
      { to: '/eventos',         icon: '📅', label: 'Eventos' },
      { to: '/promotor/vender', icon: '🎫', label: 'Vender' },
      { to: '/promotor',        icon: '🔗', label: 'Mi Panel' },
      { to: '/mas',             icon: '⋯',  label: 'Más' },
    ],
    jefe_publicas: [
      { to: '/eventos',         icon: '📅', label: 'Eventos' },
      { to: '/promotor/vender', icon: '🎫', label: 'Vender' },
      { to: '/promotor',        icon: '👑', label: 'Mi Panel' },
      { to: '/mas',             icon: '⋯',  label: 'Más' },
    ],
    vendedor: [
      { to: '/eventos',         icon: '📅', label: 'Eventos' },
      { to: '/promotor/vender', icon: '🎫', label: 'Vender' },
      { to: '/promotor',        icon: '🔗', label: 'Mi Panel' },
      { to: '/mas',             icon: '⋯',  label: 'Más' },
    ],
  };

  const items = navMap[user?.role] || navMap.admin;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 backdrop-blur-lg border-t border-gray-800/50 safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {items.map(item => {
          const isActive = location.pathname === item.to || 
            (item.to !== '/eventos' && location.pathname.startsWith(item.to));
          
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs font-medium transition-all min-w-[60px] ${
                isActive 
                  ? 'text-brand' 
                  : 'text-gray-500 active:text-gray-300'
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
              {isActive && (
                <span className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand rounded-full" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
