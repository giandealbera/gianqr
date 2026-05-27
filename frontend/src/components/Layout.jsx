import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

const Layout = ({ children }) => {
  const { user } = useAuth();

  return (
    // min-h-dvh respeta el viewport real de iOS Safari (que cambia cuando
    // muestra/oculta la barra de URL). Antes con min-h-dvh el header
    // quedaba tapado al hacer scroll hacia abajo.
    <div className="flex min-h-dvh bg-gray-950">
      {/* Sidebar desktop */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main content. pb-24 deja espacio para el BottomNav fijo + safe-area
          en iPhones con home indicator. */}
      <main className="flex-1 pb-24 lg:pb-0">
        {/* Header mobile sticky. Sumamos pt-safe para que el contenido
            del header (logo, nombre) no quede debajo del notch / Dynamic
            Island en iPhones con safe-area-inset-top.
            Usamos `top-0` + sticky para que se quede pegado durante el
            scroll, y el padding-top maneja el inset. */}
        <header className="lg:hidden sticky top-0 z-30 bg-gray-950/85 backdrop-blur-lg border-b border-gray-800/50 pt-safe">
          <div className="px-4 py-3 flex items-center justify-between safe-area-x">
            <div>
              <span className="text-xl font-black text-brand select-none">GianQR</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 truncate max-w-[120px]">{user?.name}</span>
              <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-brand text-sm font-bold shrink-0">
                {user?.name?.charAt(0)?.toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {children}
      </main>

      {/* Bottom nav mobile. safe-area-bottom ya esta dentro del componente. */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
};

export default Layout;
