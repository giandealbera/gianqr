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

// GET /api/users/promoter-sales — admin ve ventas de todos los promotores
const getPromoterSales = async (req, res) => {
  const { event_id } = req.query;
  try {
    let eventFilter = '';
    let params = [];
    if (event_id) {
      eventFilter = 'AND t.event_id = ?';
      params.push(event_id);
    }
    const result = await db.query(
      `SELECT p.id AS promotor_id, u.name, p.promo_code, p.commission,
              COUNT(t.id) AS total_vendidas,
              SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END) AS total_recaudado,
              SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid * (p.commission / 100.0) ELSE 0 END) AS comision_promotor,
              SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid * (1 - p.commission / 100.0) ELSE 0 END) AS debe_enviar
       FROM promotors p
       JOIN users u ON u.id = p.user_id AND u.is_active = 1
       LEFT JOIN tickets t ON t.promotor_id = p.id ${eventFilter}
       GROUP BY p.id
       ORDER BY total_recaudado DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener ventas de promotores' });
  }
};

// GET /api/users/my-sales — el promotor ve sus propias ventas
const getMyPromoterSales = async (req, res) => {
  const userId = req.user.id;
  try {
    // Buscar promotor
    const promoResult = await db.query('SELECT * FROM promotors WHERE user_id = ?', [userId]);
    const promo = promoResult.rows[0];
    if (!promo) return res.status(404).json({ error: 'No sos promotor' });

    // Resumen general
    const summary = await db.query(
      `SELECT
         COUNT(t.id) AS total_vendidas,
         SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END) AS total_recaudado,
         SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid * (? / 100.0) ELSE 0 END) AS mi_comision,
         SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid * (1 - ? / 100.0) ELSE 0 END) AS debo_enviar
       FROM tickets t
       WHERE t.promotor_id = ?`,
      [promo.commission, promo.commission, promo.id]
    );

    // Desglose por evento
    const byEvent = await db.query(
      `SELECT e.name AS evento, e.date,
              COUNT(t.id) AS vendidas,
              SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END) AS recaudado,
              SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid * (1 - ? / 100.0) ELSE 0 END) AS a_enviar
       FROM tickets t
       JOIN events e ON e.id = t.event_id
       WHERE t.promotor_id = ?
       GROUP BY e.id
       ORDER BY e.date DESC`,
      [promo.commission, promo.id]
    );

    // Últimas ventas
    const recent = await db.query(
      `SELECT t.buyer_name, t.amount_paid, t.status, t.created_at,
              e.name AS evento, tt.name AS tipo_entrada
       FROM tickets t
       JOIN events e ON e.id = t.event_id
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       WHERE t.promotor_id = ?
       ORDER BY t.created_at DESC LIMIT 50`,
      [promo.id]
    );

    res.json({
      promo_code: promo.promo_code,
      commission: promo.commission,
      summary: summary.rows[0],
      by_event: byEvent.rows,
      recent: recent.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tus ventas' });
  }
};

module.exports = { getAll, create, update, deactivate, getPromoterSales, getMyPromoterSales };
