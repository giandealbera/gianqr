const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const db     = require('../config/database');
const { sendMail } = require('../utils/mailer');
const { logAudit } = require('../utils/auditLog');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  if (!EMAIL_REGEX.test(email))
    return res.status(400).json({ error: 'Email inválido' });

  try {
    const result = await db.query(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email.toLowerCase()]
    );
    const user = result.rows[0];
    if (!user) {
      // No revelamos si el email existe o no — para audit log igual nos
      // sirve trazar el intento (sin user_id), para detectar credential
      // stuffing.
      logAudit(req, 'AUTH_LOGIN_FAILED', { details: { reason: 'user_not_found_or_inactive', email: email.toLowerCase() } });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logAudit(req, 'AUTH_LOGIN_FAILED', {
        details: { reason: 'bad_password', email: email.toLowerCase() },
        actorOverride: { id: user.id, email: user.email, role: user.role },
      });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h', algorithm: 'HS256' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, must_change_password: !!user.must_change_password },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/auth/me
const me = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, created_at, must_change_password FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    const u = result.rows[0];
    res.json({ ...u, must_change_password: !!u.must_change_password });
  } catch (err) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/auth/magic/:token — login instantáneo sin contraseña (UNA SOLA VEZ)
const magicLogin = async (req, res) => {
  const { token } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM users WHERE magic_token = ? AND is_active = 1',
      [token]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Link inválido o ya usado' });

    // Expiracion: si el link tiene expiracion seteada y ya paso, lo invalidamos.
    // magic_token_expires NULL = legacy (token sin expiracion, sigue valiendo).
    if (user.magic_token_expires) {
      const raw = String(user.magic_token_expires);
      const iso = raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z';
      if (Date.now() > new Date(iso).getTime()) {
        await db.query('UPDATE users SET magic_token = NULL, magic_token_expires = NULL WHERE id = ?', [user.id]);
        return res.status(410).json({ error: 'Link vencido. Pedile al jefe uno nuevo.' });
      }
    }

    // Invalidar el token: el link es de un solo uso. Si el vendedor pierde el
    // acceso, el jefe puede generarle uno nuevo desde su panel.
    await db.query('UPDATE users SET magic_token = NULL, magic_token_expires = NULL WHERE id = ?', [user.id]);

    const jwt_token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h', algorithm: 'HS256' }
    );
    res.json({
      token: jwt_token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('magicLogin error:', err.message);
    res.status(500).json({ error: 'Error interno' });
  }
};

// POST /api/auth/forgot-password — recibe email, genera reset_token, envia mail
// (o lo loguea si no hay Resend configurado). Siempre devuelve la misma respuesta
// generica para no permitir enumeracion de emails.
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requerido' });

  // Respuesta generica: enviada incluso si el email no existe (anti-enumeration)
  const genericReply = { message: 'Si el email existe en el sistema, te enviamos las instrucciones para resetear tu contraseña' };

  try {
    const result = await db.query(
      'SELECT id, name, email FROM users WHERE email = ? AND is_active = 1',
      [email.toLowerCase()]
    );
    const user = result.rows[0];
    if (!user) {
      // No revelamos que el email no existe. Esperamos un poco para que el
      // timing no delate la diferencia.
      await new Promise(r => setTimeout(r, 200));
      return res.json(genericReply);
    }

    // Token random de 32 bytes hex (64 chars) — imposible de adivinar
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h
    await db.query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
      [resetToken, expiresAt, user.id]
    );

    const frontUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontUrl}/reset-password/${resetToken}`;

    await sendMail({
      to: user.email,
      subject: 'GianQR — Reset de contraseña',
      text: `Hola ${user.name},\n\nPediste resetear tu contraseña. Hacé click en este link (vale 1 hora):\n\n${resetLink}\n\nSi no fuiste vos, ignorá este mensaje.\n\n— GianQR`,
      html: `<p>Hola ${user.name},</p><p>Pediste resetear tu contraseña. Hacé click en este link (vale 1 hora):</p><p><a href="${resetLink}">${resetLink}</a></p><p>Si no fuiste vos, ignorá este mensaje.</p><p>— GianQR</p>`,
    });

    res.json(genericReply);
  } catch (err) {
    console.error('forgotPassword error:', err.message);
    // Aun en caso de error, respondemos generico para no filtrar info
    res.json(genericReply);
  }
};

// POST /api/auth/reset-password — recibe token + nueva password, valida y resetea
const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password)
    return res.status(400).json({ error: 'Token y nueva contraseña son requeridos' });
  if (password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

  try {
    const result = await db.query(
      'SELECT id, reset_token_expires FROM users WHERE reset_token = ? AND is_active = 1',
      [token]
    );
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Link inválido o ya usado' });

    // Verificar expiracion
    if (new Date(user.reset_token_expires) < new Date()) {
      // Limpiar el token expirado y devolver error
      await db.query('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?', [user.id]);
      return res.status(400).json({ error: 'El link expiró. Pedí uno nuevo desde "Olvidé mi contraseña"' });
    }

    const hash = await bcrypt.hash(password, 10);
    // Reset por mail tambien limpia must_change_password (la password nueva
    // es responsabilidad del usuario, no del creador).
    await db.query(
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, password_changed_at = CURRENT_TIMESTAMP, must_change_password = 0 WHERE id = ?',
      [hash, user.id]
    );

    res.json({ message: 'Contraseña actualizada. Ya podés iniciar sesión.' });
  } catch (err) {
    console.error('resetPassword error:', err.message);
    res.status(500).json({ error: 'Error al resetear contraseña' });
  }
};

// POST /api/auth/change-password — usuario logueado cambia su propia contraseña.
// Si must_change_password=1 (primer login con clave del creador o vino via
// magic link), NO exigimos currentPassword: el JWT actual ya prueba que el
// usuario tiene acceso, y la idea es justamente que el creador deje de
// poder loguearse como él.
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword)
    return res.status(400).json({ error: 'Nueva contraseña requerida' });
  if (newPassword.length < 8)
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });

  try {
    const result = await db.query('SELECT id, password_hash, must_change_password FROM users WHERE id = ? AND is_active = 1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    if (!user.must_change_password) {
      // Cambio normal: pide la actual y valida.
      if (!currentPassword)
        return res.status(400).json({ error: 'Contraseña actual requerida' });
      if (currentPassword === newPassword)
        return res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual' });
      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }
    // En modo must_change_password, saltamos la verificacion: el JWT es la
    // prueba de identidad (le llego via magic link o le dieron una clave
    // que ya esta cambiando).

    const hash = await bcrypt.hash(newPassword, 10);
    // Apaga must_change_password: el usuario ya seteo la suya propia.
    await db.query('UPDATE users SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP, must_change_password = 0 WHERE id = ?', [hash, user.id]);

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('changePassword error:', err.message);
    res.status(500).json({ error: 'Error al cambiar la contraseña' });
  }
};

module.exports = { login, me, magicLogin, forgotPassword, resetPassword, changePassword };
