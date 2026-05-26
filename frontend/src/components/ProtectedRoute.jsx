import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Si el usuario tiene que cambiar la password (recien creado por jefe/owner),
  // forzamos /cambiar-password. Asi el creador no conserva acceso a la cuenta.
  // Excepcion: la propia ruta /cambiar-password y /configuracion para que pueda
  // ver la pantalla.
  if (user.must_change_password && location.pathname !== '/cambiar-password') {
    return <Navigate to="/cambiar-password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/sin-acceso" replace />;
  }

  return children;
};

export default ProtectedRoute;
