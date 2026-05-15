const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const PUBLICAS_ROLES = ['promotor', 'jefe_publicas', 'vendedor'];

// Genera un promo_code random de 10 chars (alfabeto sin chars ambiguos).
// 32^10 = 1.1e15 combinaciones - cambiar una letra al azar nunca cae en otro valido.
const PROMO_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genPromoCode() {
  const bytes = crypto.randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) out += PROMO_CHARS[bytes[i] % PROMO_CHARS.length];
  return out;
}

const getAll = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.apellido, u.celular, u.localidad,
              u.email, u.role, u.is_active, u.created_at,
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
  const { name, apellido, celular, localidad, email, password, role,
          promo_code, commission, leader_id, leader_commission } = req.body;

  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'name, email, password y role son requeridos' });

  const validRoles = ['admin', 'cajero', 'promotor', 'jefe_publicas', 'vendedor'];
  if (!validRoles.includes(role))
    return res.status(400).json({ error: 'Rol inválido' });

  try {
    const hash   = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await db.query(
      'INSERT INTO users (id, name, apellido, celular, localidad, email, password_hash, role) VALUES (?,?,?,?,?,?,?,?)',
      [userId, name, apellido || null, celular || null, localidad || null, email.toLowerCase(), hash, role]
    );

    let promoCode = null;
    if (PUBLICAS_ROLES.includes(role)) {
      promoCode = promo_code || genPromoCode();
      await db.query(
        'INSERT INTO promotors (id, user_id, promo_code, commission, leader_id, leader_commission) VALUES (?,?,?,?,?,?)',
        [uuidv4(), userId, promoCode, commission ?? 800, leader_id || null, leader_commission ?? 400]
      );
    }

    res.status(201).json({ id: userId, name, email: email.toLowerCase(), role, promo_code: promoCode, leader_id });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) return res.status(409).json({ error: 'El email ya está registrado' });
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};

// POST /api/users/team — jefe_publicas agrega un vendedor a su equipo
const createTeamMember = async (req, res) => {
  const jefeId = req.user.id;
  const { name, apellido, celular, localidad, email, password, commission } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: 'name, email y password son requeridos' });

  try {
    const jefePromo = await db.query('SELECT * FROM promotors WHERE user_id = ?', [jefeId]);
    const jefe = jefePromo.rows[0];
    if (!jefe) return res.status(400).json({ error: 'No tenés un perfil de públicas registrado' });

    const hash       = await bcrypt.hash(password, 10);
    const userId     = uuidv4();
    const promoCode  = genPromoCode();
    const magicToken = uuidv4();

    await db.query(
      'INSERT INTO users (id, name, apellido, celular, localidad, email, password_hash, role, magic_token) VALUES (?,?,?,?,?,?,?,?,?)',
      [userId, name, apellido || null, celular || null, localidad || null, email.toLowerCase(), hash, 'vendedor', magicToken]
    );

    await db.query(
      'INSERT INTO promotors (id, user_id, promo_code, commission, leader_id, leader_commission) VALUES (?,?,?,?,?,?)',
      [uuidv4(), userId, promoCode, commission ?? 800, jefeId, jefe.leader_commission ?? 400]
    );

    res.status(201).json({ id: userId, name, email: email.toLowerCase(), role: 'vendedor', promo_code: promoCode, magic_token: magicToken });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) return res.status(409).json({ error: 'El email ya está registrado' });
    console.error(err);
    res.status(500).json({ error: 'Error al crear vendedor' });
  }
};

// GET /api/users/my-team — jefe ve a sus vendedores
const getMyTeam = async (req, res) => {
  const jefeId = req.user.id;
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.apellido, u.celular, u.localidad, u.email, u.is_active, u.created_at,
              u.magic_token,
              p.promo_code, p.commission,
              COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS total_vendidas,
              SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END) AS total_recaudado
       FROM users u
       JOIN promotors p ON p.user_id = u.id
       LEFT JOIN tickets t ON t.promotor_id = p.id
       WHERE p.leader_id = ?
       GROUP BY u.id
       ORDER BY total_recaudado DESC`,
      [jefeId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener equipo' });
  }
};

const update = async (req, res) => {
  const { id } = req.params;
  const { name, apellido, celular, localidad, email, role, is_active, password, commission, leader_id, leader_commission } = req.body;
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await db.query(
        'UPDATE users SET name=?, apellido=?, celular=?, localidad=?, email=?, role=?, is_active=?, password_hash=? WHERE id=?',
        [name, apellido || null, celular || null, localidad || null, email?.toLowerCase(), role, is_active ? 1 : 0, hash, id]
      );
    } else {
      await db.query(
        'UPDATE users SET name=?, apellido=?, celular=?, localidad=?, email=?, role=?, is_active=? WHERE id=?',
        [name, apellido || null, celular || null, localidad || null, email?.toLowerCase(), role, is_active ? 1 : 0, id]
      );
    }

    if (PUBLICAS_ROLES.includes(role)) {
      // Si ya tenia fila en promotors -> UPDATE. Si no -> INSERT (ascenso desde cajero/admin)
      const existing = await db.query('SELECT id FROM promotors WHERE user_id = ?', [id]);
      if (existing.rows[0]) {
        await db.query(
          'UPDATE promotors SET commission=?, leader_id=?, leader_commission=? WHERE user_id=?',
          [commission ?? 800, leader_id || null, leader_commission ?? 400, id]
        );
      } else {
        const promoCode = genPromoCode();
        await db.query(
          'INSERT INTO promotors (id, user_id, promo_code, commission, leader_id, leader_commission) VALUES (?,?,?,?,?,?)',
          [uuidv4(), id, promoCode, commission ?? 800, leader_id || null, leader_commission ?? 400]
        );
      }
    }

    res.json({ id, name, email, role, is_active });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
};

const deactivate = async (req, res) => {
  try {
    await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Usuario desactivado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
};

// GET /api/users/promoter-sales — admin ve ventas de todos
const getPromoterSales = async (req, res) => {
  const { event_id } = req.query;
  try {
    let eventFilter = '';
    let params = [];
    if (event_id) { eventFilter = 'AND t.event_id = ?'; params.push(event_id); }

    const result = await db.query(
      `SELECT p.id AS promotor_id, u.name, u.apellido, u.celular, u.localidad,
              p.promo_code, p.commission, p.leader_commission,
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
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
};

// GET /api/users/my-sales — vendedor/jefe ve sus propias ventas (y equipo si es jefe)
const getMyPromoterSales = async (req, res) => {
  const userId = req.user.id;
  try {
    const promoResult = await db.query('SELECT * FROM promotors WHERE user_id = ?', [userId]);
    const promo = promoResult.rows[0];
    if (!promo) return res.status(404).json({ error: 'No tenés un perfil de públicas' });

    const summary = await db.query(
      `SELECT
         COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS total_vendidas,
         SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END) AS total_recaudado,
         (COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) * ?) AS mi_comision
       FROM tickets t WHERE t.promotor_id = ?`,
      [promo.commission, promo.id]
    );

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
    const ownComm  = summary.rows[0].mi_comision || 0;
    const teamComm = teamSummary.rows[0].mi_comision_jefe || 0;
    const debo_enviar = ownTotal - ownComm;

    const byEvent = await db.query(
      `SELECT e.name AS evento, e.date,
              COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS vendidas,
              SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END) AS recaudado,
              SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END)
                - (COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) * ?) AS a_enviar
       FROM tickets t
       JOIN events e ON e.id = t.event_id
       WHERE t.promotor_id = ?
       GROUP BY e.id ORDER BY e.date DESC`,
      [promo.commission, promo.id]
    );

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
      summary: {
        total_vendidas: summary.rows[0].total_vendidas || 0,
        total_recaudado: ownTotal,
        mi_comision: ownComm,
        debo_enviar,
        equipo_vendidas: teamSummary.rows[0].equipo_vendidas || 0,
        mi_comision_jefe: teamComm,
        es_jefe: req.user.role === 'jefe_publicas',
      },
      by_event: byEvent.rows,
      recent: recent.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tus ventas' });
  }
};

// PATCH /api/users/:id/commission — admin edita comisión de un promotor
const updateCommission = async (req, res) => {
  const { commission, leader_commission } = req.body;
  try {
    await db.query(
      'UPDATE promotors SET commission=?, leader_commission=? WHERE user_id=?',
      [commission ?? 800, leader_commission ?? 400, req.params.id]
    );
    res.json({ id: req.params.id, commission, leader_commission });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar comisión' });
  }
};

module.exports = { getAll, create, update, deactivate, getPromoterSales, getMyPromoterSales, createTeamMember, getMyTeam, updateCommission };
