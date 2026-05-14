import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const MagicLogin = () => {
  const { token } = useParams();
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${BACKEND}/auth/magic/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        localStorage.setItem('gianqr_token', data.token);
        window.location.href = '/promotor';
      })
      .catch(() => setError('No se pudo conectar al servidor'));
  }, [token]);

  if (error) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="text-red-400 text-lg font-semibold">{error}</p>
        <p className="text-gray-500 text-sm mt-2">Este link es inválido o fue desactivado.</p>
        <a href="/login" className="mt-4 inline-block text-brand underline text-sm">Ir al login</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand mx-auto mb-4" />
        <p className="text-gray-400">Iniciando sesión...</p>
      </div>
    </div>
  );
};

export default MagicLogin;
