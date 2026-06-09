import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollManager from './components/ScrollManager';
import OfflineBanner from './components/OfflineBanner';

// Páginas del flujo de auth — eager (siempre cargan rápido al abrir la app)
import Login             from './pages/Login';
import ForgotPassword    from './pages/ForgotPassword';
import ResetPassword     from './pages/ResetPassword';
// MoreMenu eager: el chunk lazy fallaba en pantallas con cache de PWA stale
// (pegada en "pantalla negra"), y como es chiquito (solo navegacion estatica)
// no aporta diferencia al bundle inicial.
import MoreMenu          from './pages/MoreMenu';

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
const Configuracion     = lazy(() => import('./pages/Configuracion'));
const ForceChangePassword = lazy(() => import('./pages/ForceChangePassword'));
const AuditLog         = lazy(() => import('./pages/admin/AuditLog'));
const TwoFactorSetup   = lazy(() => import('./pages/TwoFactorSetup'));
const Sessions         = lazy(() => import('./pages/Sessions'));

// Fallback para chunks lazy: barra superior + spinner centrado. Antes era
// solo la barrita, y un chunk lento (PWA con cache stale, red flaky) se veia
// como "pantalla negra" porque la pagina anterior ya se desmonto y no habia
// contenido visible. Con el spinner el usuario sabe que esta cargando.
const PageLoader = () => (
  <>
    <motion.div
      initial={{ scaleX: 0, opacity: 0.8 }}
      animate={{ scaleX: 0.92, opacity: 1 }}
      transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: '0% 50%', background: '#C9974D' }}
      className="fixed top-0 left-0 right-0 h-0.5 z-[60]"
    />
    <div className="flex items-center justify-center h-dvh bg-gray-950">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-brand" />
    </div>
  </>
);

// Wrapper que anima la entrada/salida de cada ruta. Slide horizontal corto
// + fade. El mode="wait" hace que la pantalla saliente termine antes de que
// arranque la entrante (sino se ven montadas en el mismo instante).
const AnimatedRoutes = ({ children }) => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// Redirige al panel según el rol del usuario logueado.
// Hoy todos los roles arrancan en /eventos; si en el futuro algun rol
// debe ir a otra landing, agregar el branching aca.
const RoleRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to="/eventos" replace />;
};

// Toaster responsive: en desktop arriba a la derecha como siempre; en mobile
// abajo al centro asi no tapa el header sticky y el dedo del usuario lo
// alcanza facil con la mano que ya esta usando para tocar.
const ResponsiveToaster = () => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return (
    <Toaster
      position={isMobile ? 'bottom-center' : 'top-right'}
      // En mobile dejamos espacio arriba del bottom-nav (96px = pb-24) +
      // safe-area-inset-bottom para no quedar tapados por el home indicator.
      containerStyle={isMobile ? { bottom: 'calc(96px + env(safe-area-inset-bottom, 0))' } : undefined}
      toastOptions={{
        style: { background: '#1f2937', color: '#f9fafb', border: '1px solid #374151' },
        success: { iconTheme: { primary: '#7C3AED', secondary: '#fff' } },
      }}
    />
  );
};

const App = () => (
  <AuthProvider>
    <ConfirmProvider>
    <BrowserRouter>
      <ScrollManager />
      <OfflineBanner />
      <ResponsiveToaster />
      <Suspense fallback={<PageLoader />}>
      <AnimatedRoutes>
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
          <div className="flex items-center justify-center h-dvh flex-col gap-4">
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
        {/* Owner usa /admin/* routes con scope a sus eventos.
            Admin tiene override total (puede entrar a todo).
            Controllers verifican ownership. */}
        <Route path="/admin/usuarios" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><Users /></ProtectedRoute>
        } />
        <Route path="/admin/reportes" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><Reports /></ProtectedRoute>
        } />
        <Route path="/admin/promotores" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><PromoterSales /></ProtectedRoute>
        } />
        <Route path="/admin/rendicion" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><Rendicion /></ProtectedRoute>
        } />
        <Route path="/admin/control" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><LiveControl /></ProtectedRoute>
        } />
        <Route path="/admin/cortesias" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><Cortesias /></ProtectedRoute>
        } />
        <Route path="/admin/historial" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><EventHistory /></ProtectedRoute>
        } />
        <Route path="/admin/proveedores" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><Proveedores /></ProtectedRoute>
        } />
        <Route path="/admin/reset-eventos" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><ResetEventos /></ProtectedRoute>
        } />
        <Route path="/admin/zonas" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><Zonas /></ProtectedRoute>
        } />
        <Route path="/admin/bitacora" element={
          <ProtectedRoute allowedRoles={['admin', 'owner']}><AuditLog /></ProtectedRoute>
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

        {/* Cambio de password obligatorio (primer login con clave del creador).
            Sin allowedRoles, debe estar accesible para cualquier rol logueado;
            ProtectedRoute permite verla justamente cuando must_change_password=1. */}
        <Route path="/cambiar-password" element={
          <ProtectedRoute><ForceChangePassword /></ProtectedRoute>
        } />

        {/* 2FA setup (cualquier rol logueado). */}
        <Route path="/configuracion/2fa" element={
          <ProtectedRoute allowedRoles={['admin', 'jefe_publicas', 'vendedor', 'owner']}><TwoFactorSetup /></ProtectedRoute>
        } />

        {/* Sesiones activas del usuario logueado. */}
        <Route path="/configuracion/sesiones" element={
          <ProtectedRoute allowedRoles={['admin', 'jefe_publicas', 'vendedor', 'owner']}><Sessions /></ProtectedRoute>
        } />

        {/* Más opciones */}
        <Route path="/mas" element={
          <ProtectedRoute allowedRoles={['admin', 'jefe_publicas', 'vendedor', 'owner']}><MoreMenu /></ProtectedRoute>
        } />

        {/* 404 */}
        <Route path="*" element={
          <div className="flex items-center justify-center h-dvh flex-col gap-4">
            <p className="text-5xl font-black text-brand">404</p>
            <p className="text-gray-400">Página no encontrada</p>
          </div>
        } />
      </Routes>
      </AnimatedRoutes>
      </Suspense>
    </BrowserRouter>
    </ConfirmProvider>
  </AuthProvider>
);

export default App;
