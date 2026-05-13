/**
 * Middleware para verificar roles de usuario.
 * Uso: roles('admin', 'cajero')
 */
const roles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acceso denegado. Se requiere rol: ${allowedRoles.join(' o ')}`,
      });
    }
    next();
  };
};

module.exports = roles;
