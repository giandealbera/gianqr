const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/database');

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña requeridos' });

  try {
    const result = await db.query(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email.toLowerCase()]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h', algorithm: 'HS256' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
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
      'SELECT id, name, email, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(result.rows[0]);
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

    // Invalidar el token: el link es de un solo uso. Si el vendedor pierde el
    // acceso, el jefe puede generarle uno nuevo desde su panel.
    await db.query('UPDATE users SET magic_token = NULL WHERE id = ?', [user.id]);

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

module.exports = { login, me, magicLogin };
