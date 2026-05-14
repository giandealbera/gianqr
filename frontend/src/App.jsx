import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Páginas
import Login             from './pages/Login';
import MyEvents          from './pages/events/MyEvents';
import EventDashboard    from './pages/events/EventDashboard';
import SoldTickets       from './pages/events/SoldTickets';
import EventStats        from './pages/events/EventStats';
import EventTicketTypes  from './pages/events/EventTicketTypes';
import Dashboard         from './pages/admin/Dashboard';
import Users             from './pages/admin/Users';
import Reports           from './pages/admin/Reports';
import PromoterSales     from './pages/admin/PromoterSales';
import Scanner           from './pages/scanner/Scanner';
import Cashier           from './pages/cashier/Cashier';
import PromoterDashboard from './pages/promoter/PromoterDashboard';
import PromoterSell     from './pages/promoter/PromoterSell';
import PublicScanner    from './pages/scanner/PublicScanner';
import MagicLogin       from './pages/MagicLogin';
import PublicBuy        from './pages/public/PublicBuy';
import MoreMenu          from './pages/MoreMenu';

// Redirige al panel según el rol del usuario logueado
const RoleRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to="/eventos" replace />;
};

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1f2937', color: '#f9fafb', border: '1px solid #374151' },
          success: { iconTheme: { primary: '#7C3AED', secondary: '#fff' } },
        }}
      />
      <Routes>
        {/* Público */}
        <Route path="/login" element={<Login />} />
        <Route path="/scan/:token" element={<PublicScanner />} />
        <Route path="/acceso/:token" element={<MagicLogin />} />
        <Route path="/comprar/:code" element={<PublicBuy />} />
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/sin-acceso" element={
          <div className="flex items-center justify-center h-screen flex-col gap-4">
            <p className="text-2xl">🚫 Sin acceso</p>
            <p className="text-gray-400">No tenés permisos para ver esta página.</p>
          </div>
        } />

        {/* Eventos — accesible para todos los roles */}
        <Route path="/eventos" element={
          <ProtectedRoute allowedRoles={['admin', 'cajero', 'promotor', 'jefe_publicas', 'vendedor']}><MyEvents /></ProtectedRoute>
        } />
        <Route path="/evento/:id" element={
          <ProtectedRoute allowedRoles={['admin', 'cajero', 'promotor', 'jefe_publicas', 'vendedor']}><EventDashboard /></ProtectedRoute>
        } />
        <Route path="/evento/:id/vendidas" element={
          <ProtectedRoute allowedRoles={['admin', 'cajero']}><SoldTickets /></ProtectedRoute>
        } />
        <Route path="/evento/:id/stats" element={
          <ProtectedRoute allowedRoles={['admin']}><EventStats /></ProtectedRoute>
        } />
        <Route path="/evento/:id/tipos" element={
          <ProtectedRoute allowedRoles={['admin']}><EventTicketTypes /></ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}><Dashboard /></ProtectedRoute>
        } />
        <Route path="/admin/eventos" element={<Navigate to="/eventos" replace />} />
        <Route path="/admin/usuarios" element={
          <ProtectedRoute allowedRoles={['admin']}><Users /></ProtectedRoute>
        } />
        <Route path="/admin/reportes" element={
          <ProtectedRoute allowedRoles={['admin']}><Reports /></ProtectedRoute>
        } />
        <Route path="/admin/promotores" element={
          <ProtectedRoute allowedRoles={['admin']}><PromoterSales /></ProtectedRoute>
        } />

        {/* Escáner (solo admin) */}
        <Route path="/escaner" element={
          <ProtectedRoute allowedRoles={['admin']}><Scanner /></ProtectedRoute>
        } />

        {/* Cajero */}
        <Route path="/caja" element={
          <ProtectedRoute allowedRoles={['admin', 'cajero']}><Cashier /></ProtectedRoute>
        } />

        {/* Promotor / Públicas */}
        <Route path="/promotor" element={
          <ProtectedRoute allowedRoles={['admin', 'promotor', 'jefe_publicas', 'vendedor']}><PromoterDashboard /></ProtectedRoute>
        } />
        <Route path="/promotor/vender" element={
          <ProtectedRoute allowedRoles={['promotor', 'jefe_publicas', 'vendedor']}><PromoterSell /></ProtectedRoute>
        } />

        {/* Más opciones */}
        <Route path="/mas" element={
          <ProtectedRoute allowedRoles={['admin', 'cajero', 'promotor', 'jefe_publicas', 'vendedor']}><MoreMenu /></ProtectedRoute>
        } />

        {/* 404 */}
        <Route path="*" element={
          <div className="flex items-center justify-center h-screen flex-col gap-4">
            <p className="text-5xl font-black text-brand">404</p>
            <p className="text-gray-400">Página no encontrada</p>
          </div>
        } />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
