const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const getAll = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
              p.promo_code, p.commission
       FROM users u
       LEFT JOIN promotors p ON p.user_id = u.id
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

const create = async (req, res) => {
  const { name, email, password, role, promo_code, commission } = req.body;
  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'name, email, password y role son requeridos' });

  const validRoles = ['admin', 'portero', 'cajero', 'promotor'];
  if (!validRoles.includes(role))
    return res.status(400).json({ error: 'Rol inválido' });

  try {
    const hash   = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await db.query(
      'INSERT INTO users (id, name, email, password_hash, role) VALUES (?,?,?,?,?)',
      [userId, name, email.toLowerCase(), hash, role]
    );

    let promoCode = null;
    if (role === 'promotor') {
      promoCode = promo_code || `PROMO${Date.now().toString(36).toUpperCase()}`;
      await db.query(
        'INSERT INTO promotors (id, user_id, promo_code, commission) VALUES (?,?,?,?)',
        [uuidv4(), userId, promoCode, commission || 0]
      );
    }

    res.status(201).json({ id: userId, name, email: email.toLowerCase(), role, promo_code: promoCode });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) return res.status(409).json({ error: 'El email ya está registrado' });
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};

const update = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, is_active, password } = req.body;
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await db.query(
        'UPDATE users SET name=?, email=?, role=?, is_active=?, password_hash=? WHERE id=?',
        [name, email?.toLowerCase(), role, is_active ? 1 : 0, hash, id]
      );
    } else {
      await db.query(
        'UPDATE users SET name=?, email=?, role=?, is_active=? WHERE id=?',
        [name, email?.toLowerCase(), role, is_active ? 1 : 0, id]
      );
    }
    res.json({ id, name, email, role, is_active });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

const deactivate = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
    res.json({ message: 'Usuario desactivado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
};

module.exports = { getAll, create, update, deactivate };
