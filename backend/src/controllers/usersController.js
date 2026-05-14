const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const getAll = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
              p.promo_code, p.commission, p.leader_id, p.leader_commission,
              lu.name AS leader_name
       FROM users u
       LEFT JOIN promotors p ON p.user_id = u.id
       LEFT JOIN users lu ON lu.id = p.leader_id
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

const create = async (req, res) => {
  const { name, email, password, role, promo_code, commission, leader_id, leader_commission } = req.body;
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
        'INSERT INTO promotors (id, user_id, promo_code, commission, leader_id, leader_commission) VALUES (?,?,?,?,?,?)',
        [uuidv4(), userId, promoCode, commission || 800, leader_id || null, leader_commission || 400]
      );
    }

    res.status(201).json({ id: userId, name, email: email.toLowerCase(), role, promo_code: promoCode, leader_id });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) return res.status(409).json({ error: 'El email ya está registrado' });
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};

const update = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, is_active, password, commission, leader_id, leader_commission } = req.body;
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

    if (role === 'promotor') {
      await db.query(
        'UPDATE promotors SET commission=?, leader_id=?, leader_commission=? WHERE user_id=?',
        [commission || 800, leader_id || null, leader_commission || 400, id]
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
      `SELECT p.id AS promotor_id, u.name, p.promo_code, p.commission, p.leader_commission,
              lu.name AS leader_name,
              COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS total_vendidas,
              SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END) AS total_recaudado,
              (COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) * p.commission) AS comision_promotor,
              (COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) * p.leader_commission) AS comision_jefe,
              SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END) 
                - (COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) * p.commission) 
                - (COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) * p.leader_commission) AS debe_enviar
       FROM promotors p
       JOIN users u ON u.id = p.user_id AND u.is_active = 1
       LEFT JOIN users lu ON lu.id = p.leader_id
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

// GET /api/users/my-sales — el promotor ve sus propias ventas (y las de su equipo si es jefe)
const getMyPromoterSales = async (req, res) => {
  const userId = req.user.id;
  try {
    // Buscar promotor actual
    const promoResult = await db.query('SELECT * FROM promotors WHERE user_id = ?', [userId]);
    const promo = promoResult.rows[0];
    if (!promo) return res.status(404).json({ error: 'No sos promotor' });

    // Mis ventas propias
    const summary = await db.query(
      `SELECT
         COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS total_vendidas,
         SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END) AS total_recaudado,
         (COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) * ?) AS mi_comision
       FROM tickets t
       WHERE t.promotor_id = ?`,
      [promo.commission, promo.id]
    );

    // Ventas de mi equipo (si soy jefe)
    const teamSummary = await db.query(
      `SELECT
         COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS equipo_vendidas,
         SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END) AS equipo_recaudado,
         SUM(CASE WHEN t.status IN ('pagado','usado') THEN p.leader_commission ELSE 0 END) AS mi_comision_jefe
       FROM tickets t
       JOIN promotors p ON p.id = t.promotor_id
       WHERE p.leader_id = ?`,
      [userId]
    );

    const ownTotal = summary.rows[0].total_recaudado || 0;
    const ownComm = summary.rows[0].mi_comision || 0;
    const teamTotal = teamSummary.rows[0].equipo_recaudado || 0;
    const teamComm = teamSummary.rows[0].mi_comision_jefe || 0;
    
    // Lo que tengo que rendir a la org es: Toda la plata que me entró a mí (ownTotal) MENOS mis ganancias totales
    // Asumimos que los vendedores le dan toda la plata al jefe y el jefe rinde? 
    // O el vendedor rinde directo a la org? 
    // "cuanta plata tiene que enviarme" -> Cada promotor recauda su venta.
    // El vendedor tiene: ownTotal. Se queda con su ownComm y le da el resto a la org (o al jefe).
    // Si la org recibe directo, el promotor rinde: ownTotal - ownComm (y la org le paga al jefe).
    // El jefe si vendió rinde: ownTotal - ownComm. Y además tiene que COBRAR su teamComm de la org.
    const debo_enviar = ownTotal - ownComm; 

    // Desglose por evento (mis ventas)
    const byEvent = await db.query(
      `SELECT e.name AS evento, e.date,
              COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS vendidas,
              SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END) AS recaudado,
              SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END) 
                - (COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) * ?) AS a_enviar
       FROM tickets t
       JOIN events e ON e.id = t.event_id
       WHERE t.promotor_id = ?
       GROUP BY e.id
       ORDER BY e.date DESC`,
      [promo.commission, promo.id]
    );

    // Últimas ventas (mías)
    const recent = await db.query(
      `SELECT t.buyer_name, t.amount_paid, t.status, t.created_at,
              e.name AS evento, tt.name AS tipo_entrada,
              'Propia' as tipo_venta
       FROM tickets t
       JOIN events e ON e.id = t.event_id
       JOIN ticket_types tt ON tt.id = t.ticket_type_id
       WHERE t.promotor_id = ?
       ORDER BY t.created_at DESC LIMIT 50`,
      [promo.id]
    );

    res.json({
      promo_code: promo.promo_code,
      commission: promo.commission, // Monto fijo
      summary: {
        total_vendidas: summary.rows[0].total_vendidas || 0,
        total_recaudado: ownTotal,
        mi_comision: ownComm,
        debo_enviar: debo_enviar,
        // Info de equipo si aplica
        equipo_vendidas: teamSummary.rows[0].equipo_vendidas || 0,
        mi_comision_jefe: teamComm,
        es_jefe: teamSummary.rows[0].equipo_vendidas > 0
      },
      by_event: byEvent.rows,
      recent: recent.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tus ventas' });
  }
};

module.exports = { getAll, create, update, deactivate, getPromoterSales, getMyPromoterSales };
