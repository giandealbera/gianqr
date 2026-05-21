import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Páginas del flujo de auth — eager (siempre cargan rápido al abrir la app)
import Login             from './pages/Login';
import ForgotPassword    from './pages/ForgotPassword';
import ResetPassword     from './pages/ResetPassword';

// El resto: lazy. Se descargan recién cuando el user navega a esa ruta.
// El bundle inicial baja MUCHO así (de ~600KB a ~150KB).
const MyEvents          = lazy(() => import('./pages/events/MyEvents'));
const EventDashboard    = lazy(() => import('./pages/events/EventDashboard'));
const SoldTickets       = lazy(() => import('./pages/events/SoldTickets'));
const EventStats        = lazy(() => import('./pages/events/EventStats'));
const EventTicketTypes  = lazy(() => import('./pages/events/EventTicketTypes'));
const Dashboard         = lazy(() => import('./pages/admin/Dashboard'));
const Users             = lazy(() => import('./pages/admin/Users'));
const Reports           = lazy(() => import('./pages/admin/Reports'));
const PromoterSales     = lazy(() => import('./pages/admin/PromoterSales'));
const Scanner           = lazy(() => import('./pages/scanner/Scanner'));
const Cashier           = lazy(() => import('./pages/cashier/Cashier'));
const PromoterDashboard = lazy(() => import('./pages/promoter/PromoterDashboard'));
const PromoterSell      = lazy(() => import('./pages/promoter/PromoterSell'));
const PublicScanner     = lazy(() => import('./pages/scanner/PublicScanner'));
const MagicLogin        = lazy(() => import('./pages/MagicLogin'));
const PublicBuy         = lazy(() => import('./pages/public/PublicBuy'));
const Rendicion         = lazy(() => import('./pages/admin/Rendicion'));
const LiveControl       = lazy(() => import('./pages/admin/LiveControl'));
const Cortesias         = lazy(() => import('./pages/admin/Cortesias'));
const EventHistory      = lazy(() => import('./pages/admin/EventHistory'));
const Proveedores       = lazy(() => import('./pages/admin/Proveedores'));
const ResetEventos      = lazy(() => import('./pages/admin/ResetEventos'));
const Zonas             = lazy(() => import('./pages/admin/Zonas'));
const MoreMenu          = lazy(() => import('./pages/MoreMenu'));
const Configuracion     = lazy(() => import('./pages/Configuracion'));

// Spinner mostrado mientras carga un chunk lazy.
const PageLoader = () => (
  <div className="flex justify-center items-center min-h-screen" style={{ background: '#0D1117' }}>
    <div className="animate-spin rounded-full h-10 w-10 border-t-2" style={{ borderColor: '#C9974D' }} />
  </div>
);

// Redirige al panel según el rol del usuario logueado
const RoleRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'owner') return <Navigate to="/eventos" replace />;
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
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Público */}
        <Route path="/login" element={<Login />} />
        <Route path="/olvide-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
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

        <Route path="/eventos" element={
          <ProtectedRoute allowedRoles={['admin', 'jefe_publicas', 'vendedor', 'owner']}><MyEvents /></ProtectedRoute>
        } />
        <Route path="/evento/:id" element={
          <ProtectedRoute allowedRoles={['admin', 'jefe_publicas', 'vendedor', 'owner']}><EventDashboard /></ProtectedRoute>
        } />
        <Route path="/evento/:id/vendidas" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><SoldTickets /></ProtectedRoute>
        } />
        <Route path="/evento/:id/stats" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><EventStats /></ProtectedRoute>
        } />
        <Route path="/evento/:id/tipos" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><EventTicketTypes /></ProtectedRoute>
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
        <Route path="/admin/rendicion" element={
          <ProtectedRoute allowedRoles={['admin']}><Rendicion /></ProtectedRoute>
        } />
        <Route path="/admin/control" element={
          <ProtectedRoute allowedRoles={['admin']}><LiveControl /></ProtectedRoute>
        } />
        <Route path="/admin/cortesias" element={
          <ProtectedRoute allowedRoles={['admin']}><Cortesias /></ProtectedRoute>
        } />
        <Route path="/admin/historial" element={
          <ProtectedRoute allowedRoles={['admin']}><EventHistory /></ProtectedRoute>
        } />
        <Route path="/admin/proveedores" element={
          <ProtectedRoute allowedRoles={['admin']}><Proveedores /></ProtectedRoute>
        } />
        <Route path="/admin/reset-eventos" element={
          <ProtectedRoute allowedRoles={['admin']}><ResetEventos /></ProtectedRoute>
        } />
        <Route path="/admin/zonas" element={
          <ProtectedRoute allowedRoles={['admin']}><Zonas /></ProtectedRoute>
        } />

        {/* Escáner (solo admin) */}
        <Route path="/escaner" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><Scanner /></ProtectedRoute>
        } />

        {/* Caja (admin y owner — el owner ve solo sus eventos) */}
        <Route path="/caja" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><Cashier /></ProtectedRoute>
        } />

        {/* Promotor / Públicas */}
        <Route path="/promotor" element={
          <ProtectedRoute allowedRoles={['admin', 'jefe_publicas', 'vendedor']}><PromoterDashboard /></ProtectedRoute>
        } />
        <Route path="/promotor/vender" element={
          <ProtectedRoute allowedRoles={['jefe_publicas', 'vendedor']}><PromoterSell /></ProtectedRoute>
        } />

        {/* Configuración personal (todos los roles logueados) */}
        <Route path="/configuracion" element={
          <ProtectedRoute allowedRoles={['admin', 'jefe_publicas', 'vendedor', 'owner']}><Configuracion /></ProtectedRoute>
        } />

        {/* Más opciones */}
        <Route path="/mas" element={
          <ProtectedRoute allowedRoles={['admin', 'jefe_publicas', 'vendedor', 'owner']}><MoreMenu /></ProtectedRoute>
        } />

        {/* 404 */}
        <Route path="*" element={
          <div className="flex items-center justify-center h-screen flex-col gap-4">
            <p className="text-5xl font-black text-brand">404</p>
            <p className="text-gray-400">Página no encontrada</p>
          </div>
        } />
      </Routes>
      </Suspense>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
