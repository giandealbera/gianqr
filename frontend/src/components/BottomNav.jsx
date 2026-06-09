import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const Icon = ({ path }) => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const ICONS = {
  eventos:  'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  vender:   'M12 4v16m8-8H4',
  escanear: 'M3 9V6a1 1 0 011-1h3M3 15v3a1 1 0 001 1h3m11-4v3a1 1 0 01-1 1h-3m4-11h-3a1 1 0 01-1-1V3m0 0L9 9m6-6l-6 6',
  reportes: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  panel:    'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  mas:      'M5 12h.01M12 12h.01M19 12h.01',
};

// Prefetch del chunk de cada ruta. Cuando el dedo toca el item (touchstart)
// o el mouse pasa por encima, ya empezamos a descargar el bundle. Para
// cuando el usuario suelta el dedo / click, en muchos casos ya esta listo.
const PREFETCH = {
  '/eventos':         () => import('../pages/events/MyEvents'),
  '/admin':           () => import('../pages/admin/Dashboard'),
  '/admin/usuarios':  () => import('../pages/admin/Users'),
  '/admin/historial': () => import('../pages/admin/EventHistory'),
  '/admin/reportes':  () => import('../pages/admin/Reports'),
  '/caja':            () => import('../pages/cashier/Cashier'),
  '/escaner':         () => import('../pages/scanner/Scanner'),
  '/promotor':        () => import('../pages/promoter/PromoterDashboard'),
  '/promotor/vender': () => import('../pages/promoter/PromoterSell'),
  // /mas se importa eager — no necesita prefetch.
};

const navMap = {
  admin: [
    { to: '/admin',          icon: 'reportes', label: 'Dashboard'},
    { to: '/eventos',        icon: 'eventos',  label: 'Eventos'  },
    { to: '/admin/usuarios', icon: 'panel',    label: 'Dueños'   },
    { to: '/admin/historial',icon: 'reportes', label: 'Historial'},
    { to: '/mas',            icon: 'mas',      label: 'Mas'      },
  ],
  jefe_publicas: [
    { to: '/eventos',         icon: 'eventos', label: 'Eventos'  },
    { to: '/promotor/vender', icon: 'vender',  label: 'Vender'   },
    { to: '/promotor',        icon: 'panel',   label: 'Mi Panel' },
    { to: '/mas',             icon: 'mas',     label: 'Mas'      },
  ],
  vendedor: [
    { to: '/eventos',         icon: 'eventos', label: 'Eventos'  },
    { to: '/promotor/vender', icon: 'vender',  label: 'Vender'   },
    { to: '/promotor',        icon: 'panel',   label: 'Mi Panel' },
    { to: '/mas',             icon: 'mas',     label: 'Mas'      },
  ],
  owner: [
    { to: '/eventos',        icon: 'eventos',  label: 'Eventos' },
    { to: '/caja',           icon: 'vender',   label: 'Vender'  },
    { to: '/escaner',        icon: 'escanear', label: 'Escaner' },
    { to: '/admin/reportes', icon: 'reportes', label: 'Reportes'},
    { to: '/mas',            icon: 'mas',      label: 'Mas'     },
  ],
};

const BottomNav = () => {
  const { user }   = useAuth();
  const location   = useLocation();
  const items      = navMap[user?.role] || navMap.admin;

  const prefetch = (to) => {
    const fn = PREFETCH[to];
    if (fn) fn().catch(() => {/* fallo silencioso, el lazy normal lo reintenta */});
  };

  // Match por "mejor prefijo": un item se prende si su path es el mas largo
  // de los items que prefijean el pathname actual. Asi `/promotor/vender`
  // prende "Vender" y NO "Mi Panel" (`/promotor`); `/admin/usuarios` prende
  // "Dueños" y NO "Dashboard" (`/admin`).
  const activeTo = (() => {
    const exact = items.find(i => i.to === location.pathname);
    if (exact) return exact.to;
    const prefixed = items.filter(i =>
      i.to !== '/' && location.pathname.startsWith(i.to + '/')
    );
    if (prefixed.length === 0) return null;
    return prefixed.reduce((a, b) => a.to.length >= b.to.length ? a : b).to;
  })();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 safe-area-bottom safe-area-x select-none"
         style={{ background: 'rgba(13,17,23,0.97)', borderTop: '1px solid #1E2530', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-center justify-around px-1 py-1">
        {items.map(item => {
          const isActive = activeTo === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onTouchStart={() => prefetch(item.to)}
              onMouseEnter={() => prefetch(item.to)}
              className="relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs font-medium min-w-[56px]"
              style={{ color: isActive ? '#C9974D' : '#4B5568', WebkitTapHighlightColor: 'transparent' }}
            >
              {/* Pill detrás del item activo. layoutId hace que se deslice
                  fluido entre items al cambiar de tab. */}
              {isActive && (
                <motion.span
                  layoutId="bottomNavPill"
                  className="absolute inset-0 rounded-lg -z-0"
                  style={{ background: 'rgba(201,151,77,0.10)' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
              <motion.div
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="relative z-10 flex flex-col items-center gap-0.5"
              >
                <Icon path={ICONS[item.icon]} />
                <span className="tracking-wide">{item.label}</span>
              </motion.div>
              {isActive && (
                <motion.span
                  layoutId="bottomNavBar"
                  className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                  style={{ background: '#C9974D' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
