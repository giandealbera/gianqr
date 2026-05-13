import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Páginas
import Login            from './pages/Login';
import Dashboard        from './pages/admin/Dashboard';
import Events           from './pages/admin/Events';
import Users            from './pages/admin/Users';
import Reports          from './pages/admin/Reports';
import Scanner          from './pages/scanner/Scanner';
import Cashier          from './pages/cashier/Cashier';
import PromoterDashboard from './pages/promoter/PromoterDashboard';

// Redirige al panel según el rol del usuario logueado
const RoleRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const map = { admin: '/admin', cajero: '/caja', portero: '/escaner', promotor: '/promotor' };
  return <Navigate to={map[user.role] || '/admin'} replace />;
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
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/sin-acceso" element={
          <div className="flex items-center justify-center h-screen flex-col gap-4">
            <p className="text-2xl">🚫 Sin acceso</p>
            <p className="text-gray-400">No tenés permisos para ver esta página.</p>
          </div>
        } />

        {/* Admin */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}><Dashboard /></ProtectedRoute>
        } />
        <Route path="/admin/eventos" element={
          <ProtectedRoute allowedRoles={['admin']}><Events /></ProtectedRoute>
        } />
        <Route path="/admin/usuarios" element={
          <ProtectedRoute allowedRoles={['admin']}><Users /></ProtectedRoute>
        } />
        <Route path="/admin/reportes" element={
          <ProtectedRoute allowedRoles={['admin']}><Reports /></ProtectedRoute>
        } />

        {/* Portero */}
        <Route path="/escaner" element={
          <ProtectedRoute allowedRoles={['admin', 'portero']}><Scanner /></ProtectedRoute>
        } />

        {/* Cajero */}
        <Route path="/caja" element={
          <ProtectedRoute allowedRoles={['admin', 'cajero']}><Cashier /></ProtectedRoute>
        } />

        {/* Promotor */}
        <Route path="/promotor" element={
          <ProtectedRoute allowedRoles={['admin', 'promotor']}><PromoterDashboard /></ProtectedRoute>
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
