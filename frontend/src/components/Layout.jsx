import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';

const Layout = ({ children }) => {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar desktop */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main content */}
      <main className="flex-1 pb-20 lg:pb-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-gray-950/80 backdrop-blur-lg border-b border-gray-800/50 px-4 py-3 flex items-center justify-between">
          <div>
            <span className="text-xl font-black text-brand">GianQR</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">{user?.name}</span>
            <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-brand text-sm font-bold">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
          </div>
        </header>
        
        {children}
      </main>

      {/* Bottom nav mobile */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
};

export default Layout;
