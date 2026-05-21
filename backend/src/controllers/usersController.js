const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const PUBLICAS_ROLES = ['jefe_publicas', 'vendedor'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    // Admin: ve todos los users. Para gestion SaaS necesita la lista
    // completa (dueños + staff existente).
    // Owner: ve SOLO el staff que creo el (created_by = owner.id).
    //   - Owners no se ven a si mismos, no ven a otros owners ni al admin.
    //   - El vendedor que un jefe (que es del owner) creo via /team
    //     tambien debe heredar created_by = owner.
    const where = req.user.role === 'owner'
      ? 'WHERE u.created_by = ? OR (u.created_by IN (SELECT id FROM users WHERE created_by = ?))'
      : '';
    const params = req.user.role === 'owner' ? [req.user.id, req.user.id] : [];

    const result = await db.query(
      `SELECT u.id, u.name, u.apellido, u.celular, u.localidad,
              u.email, u.role, u.is_active, u.created_at,
              p.promo_code, p.commission, p.leader_id, p.leader_commission,
              p.zona_id, z.name AS zona_name,
              lu.name AS leader_name
       FROM users u
       LEFT JOIN promotors p ON p.user_id = u.id
       LEFT JOIN zonas z ON z.id = p.zona_id
       LEFT JOIN users lu ON lu.id = p.leader_id
       ${where}
       ORDER BY u.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
};

const create = async (req, res) => {
  const { name, apellido, celular, localidad, email, password, role,
          promo_code, commission, leader_id, leader_commission, zona_id } = req.body;

  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'name, email, password y role son requeridos' });
  if (!EMAIL_REGEX.test(email))
    return res.status(400).json({ error: 'Email inválido (formato esperado: usuario@dominio.com)' });
  if (password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

  const validRoles = ['admin', 'jefe_publicas', 'vendedor', 'owner'];
  if (!validRoles.includes(role))
    return res.status(400).json({ error: 'Rol inválido' });

  // Owner solo puede crear staff propio (jefe/vendedor). No puede crear
  // admin ni otros owners (eso es responsabilidad del admin SaaS).
  if (req.user.role === 'owner' && !['jefe_publicas', 'vendedor'].includes(role))
    return res.status(403).json({ error: 'Solo podés crear Jefes y Vendedores' });

  try {
    const hash   = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    // Marcamos quien lo creo para multi-tenant scoping.
    const createdBy = req.user.role === 'owner' ? req.user.id : null;

    await db.query(
      'INSERT INTO users (id, name, apellido, celular, localidad, email, password_hash, role, created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      [userId, name, apellido || null, celular || null, localidad || null, email.toLowerCase(), hash, role, createdBy]
    );

    let promoCode = null;
    if (PUBLICAS_ROLES.includes(role)) {
      promoCode = promo_code || genPromoCode();
      await db.query(
        'INSERT INTO promotors (id, user_id, promo_code, commission, leader_id, leader_commission, zona_id) VALUES (?,?,?,?,?,?,?)',
        [uuidv4(), userId, promoCode, commission ?? 800, leader_id || null, leader_commission ?? 400, zona_id || null]
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
  if (!EMAIL_REGEX.test(email))
    return res.status(400).json({ error: 'Email inválido' });
  if (password.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

  try {
    const jefePromo = await db.query('SELECT * FROM promotors WHERE user_id = ?', [jefeId]);
    const jefe = jefePromo.rows[0];
    if (!jefe) return res.status(400).json({ error: 'No tenés un perfil de públicas registrado' });

    const hash       = await bcrypt.hash(password, 10);
    const userId     = uuidv4();
    const promoCode  = genPromoCode();
    const magicToken = uuidv4();

    // Hereda created_by del jefe (que lo heredo de su owner). Asi el vendedor
    // queda en el "tenant" del owner correcto.
    const jefeUser = await db.query('SELECT created_by FROM users WHERE id = ?', [jefeId]);
    const inheritedCreatedBy = jefeUser.rows[0]?.created_by || null;

    await db.query(
      'INSERT INTO users (id, name, apellido, celular, localidad, email, password_hash, role, magic_token, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [userId, name, apellido || null, celular || null, localidad || null, email.toLowerCase(), hash, 'vendedor', magicToken, inheritedCreatedBy]
    );

    // El vendedor hereda automaticamente la zona del jefe que lo creo
    await db.query(
      'INSERT INTO promotors (id, user_id, promo_code, commission, leader_id, leader_commission, zona_id) VALUES (?,?,?,?,?,?,?)',
      [uuidv4(), userId, promoCode, commission ?? 800, jefeId, jefe.leader_commission ?? 400, jefe.zona_id || null]
    );

    res.status(201).json({ id: userId, name, email: email.toLowerCase(), role: 'vendedor', promo_code: promoCode, magic_token: magicToken });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) return res.status(409).json({ error: 'El email ya está registrado' });
    console.error(err);
    res.status(500).json({ error: 'Error al crear vendedor' });
  }
};

// DELETE /api/users/team/:id — jefe quita un vendedor de su equipo (soft delete)
const removeTeamMember = async (req, res) => {
  const jefeId = req.user.id;
  const userId = req.params.id;
  try {
    const check = await db.query(
      `SELECT 1 FROM promotors WHERE user_id = ? AND leader_id = ?`,
      [userId, jefeId]
    );
    if (!check.rows[0]) return res.status(403).json({ error: 'Ese usuario no es miembro de tu equipo' });
    await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [userId]);
    res.json({ message: 'Vendedor desactivado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al desactivar vendedor' });
  }
};

// GET /api/users/my-team — jefe ve a sus vendedores
const getMyTeam = async (req, res) => {
  const jefeId = req.user.id;
  try {
    // Comision del jefe (la usamos para mostrarle ganancia por vendedor)
    const jefeRow = await db.query('SELECT leader_commission, zona_id FROM promotors WHERE user_id = ?', [jefeId]);
    const leaderCommission = jefeRow.rows[0]?.leader_commission || 0;

    // No exponemos u.magic_token: el token es de un solo uso y mostrarlo aca
    // permitiria al jefe re-utilizar el token para impersonar al vendedor.
    const result = await db.query(
      `SELECT u.id, u.name, u.apellido, u.celular, u.localidad, u.email, u.is_active, u.created_at,
              p.promo_code, p.commission, p.zona_id, z.name AS zona_name,
              COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS total_vendidas,
              SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END) AS total_recaudado,
              (COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) * ?) AS mi_ganancia
       FROM users u
       JOIN promotors p ON p.user_id = u.id
       LEFT JOIN zonas z ON z.id = p.zona_id
       LEFT JOIN tickets t ON t.promotor_id = p.id
       WHERE p.leader_id = ?
       GROUP BY u.id, p.id, z.id
       ORDER BY total_recaudado DESC`,
      [leaderCommission, jefeId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener equipo' });
  }
};

const update = async (req, res) => {
  const { id } = req.params;
  const { name, apellido, celular, localidad, email, role, is_active, password, commission, leader_id, leader_commission, zona_id } = req.body;

  const validRoles = ['admin', 'jefe_publicas', 'vendedor', 'owner'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }

  try {
    // Obtener el estado actual del usuario que se quiere modificar para evitar auto-bloqueo de admin
    const currentResult = await db.query('SELECT role, is_active, created_by FROM users WHERE id = ?', [id]);
    const currentUser = currentResult.rows[0];
    if (!currentUser) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Owner solo puede modificar a SU propio staff (no admin/owner ajenos).
    if (req.user.role === 'owner') {
      const isMyStaff = currentUser.created_by === req.user.id;
      // Vendedor creado por mi jefe: created_by del vendedor apunta al jefe;
      // y el jefe tiene created_by = owner.id.
      let isMyTeamMember = false;
      if (!isMyStaff && currentUser.created_by) {
        const c = await db.query('SELECT created_by FROM users WHERE id = ?', [currentUser.created_by]);
        isMyTeamMember = c.rows[0]?.created_by === req.user.id;
      }
      if (!isMyStaff && !isMyTeamMember)
        return res.status(403).json({ error: 'No tenés acceso a este usuario' });
      // Owner no puede ascender a nadie a admin/owner.
      if (role && !['jefe_publicas', 'vendedor'].includes(role))
        return res.status(403).json({ error: 'Solo podés asignar Jefes y Vendedores' });
    }

    if (currentUser.role === 'admin' && currentUser.is_active === 1) {
      const willBeDeactivated = is_active !== undefined && !is_active;
      const willChangeRole = role !== undefined && role !== 'admin';

      if (willBeDeactivated || willChangeRole) {
        // Contar otros administradores activos
        const adminCountResult = await db.query(
          "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1 AND id != ?",
          [id]
        );
        const activeAdmins = parseInt(adminCountResult.rows[0]?.count || 0, 10);
        if (activeAdmins === 0) {
          return res.status(400).json({ error: 'No se puede desactivar ni cambiar el rol del único administrador activo' });
        }
      }
    }

    // PARTIAL UPDATE: solo actualizamos los campos provistos en el body.
    // Antes el endpoint requeria mandar TODO el user; un PUT con un solo
    // campo seteaba el resto a null y rompia con NOT NULL constraint.
    const userFields = [];
    const userValues = [];
    const setIf = (key, value, transform = v => v) => {
      if (value !== undefined) {
        userFields.push(`${key}=?`);
        userValues.push(transform(value));
      }
    };
    setIf('name',      name);
    setIf('apellido',  apellido,  v => v || null);
    setIf('celular',   celular,   v => v || null);
    setIf('localidad', localidad, v => v || null);
    setIf('email',     email,     v => v?.toLowerCase());
    setIf('role',      role);
    setIf('is_active', is_active, v => v ? 1 : 0);
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      userFields.push('password_hash=?');
      userValues.push(hash);
    }
    if (userFields.length > 0) {
      userValues.push(id);
      await db.query(`UPDATE users SET ${userFields.join(', ')} WHERE id=?`, userValues);
    }

    // Sincronizar fila en promotors si el usuario es (o pasa a ser) publica.
    const finalRole = role ?? currentUser.role;
    if (PUBLICAS_ROLES.includes(finalRole)) {
      const existing = await db.query('SELECT id, commission, leader_id, leader_commission, zona_id FROM promotors WHERE user_id = ?', [id]);
      const prev = existing.rows[0];
      if (prev) {
        // Partial update del promotor: defaults a los valores actuales si no vinieron.
        await db.query(
          'UPDATE promotors SET commission=?, leader_id=?, leader_commission=?, zona_id=? WHERE user_id=?',
          [
            commission ?? prev.commission,
            leader_id === undefined ? prev.leader_id : (leader_id || null),
            leader_commission ?? prev.leader_commission,
            zona_id === undefined ? prev.zona_id : (zona_id || null),
            id,
          ]
        );
      } else {
        // Ascenso desde otro rol → crear fila nueva con defaults.
        const promoCode = genPromoCode();
        await db.query(
          'INSERT INTO promotors (id, user_id, promo_code, commission, leader_id, leader_commission, zona_id) VALUES (?,?,?,?,?,?,?)',
          [uuidv4(), id, promoCode, commission ?? 800, leader_id || null, leader_commission ?? 400, zona_id || null]
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
  const { id } = req.params;
  try {
    // Obtener el estado actual del usuario que se quiere desactivar
    const currentResult = await db.query('SELECT role, is_active, created_by FROM users WHERE id = ?', [id]);
    const currentUser = currentResult.rows[0];
    if (!currentUser) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Owner solo puede desactivar a SU staff (mismo check que update).
    if (req.user.role === 'owner') {
      const isMyStaff = currentUser.created_by === req.user.id;
      let isMyTeamMember = false;
      if (!isMyStaff && currentUser.created_by) {
        const c = await db.query('SELECT created_by FROM users WHERE id = ?', [currentUser.created_by]);
        isMyTeamMember = c.rows[0]?.created_by === req.user.id;
      }
      if (!isMyStaff && !isMyTeamMember)
        return res.status(403).json({ error: 'No tenés acceso a este usuario' });
    }

    if (currentUser.role === 'admin' && currentUser.is_active === 1) {
      // Contar otros administradores activos
      const adminCountResult = await db.query(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1 AND id != ?",
        [id]
      );
      const activeAdmins = parseInt(adminCountResult.rows[0]?.count || 0, 10);
      if (activeAdmins === 0) {
        return res.status(400).json({ error: 'No se puede desactivar al único administrador activo' });
      }
    }

    await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
    res.json({ message: 'Usuario desactivado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
};

// GET /api/users/promoter-sales — admin ve todos; owner solo de sus eventos
const getPromoterSales = async (req, res) => {
  const { event_id } = req.query;
  try {
    let eventFilter = '';
    let params = [];
    if (event_id) { eventFilter = 'AND t.event_id = ?'; params.push(event_id); }
    // Owner: limitar tickets a SUS eventos.
    if (req.user.role === 'owner') {
      eventFilter += ' AND t.event_id IN (SELECT event_id FROM event_owners WHERE user_id = ?)';
      params.push(req.user.id);
    }

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
       WHERE u.role != 'admin' AND p.promo_code != 'CASA'
       ${req.user.role === 'owner'
         ? `AND (u.created_by = ?
                 OR u.created_by IN (SELECT id FROM users WHERE created_by = ?))`
         : ''}
       GROUP BY p.id, u.id, lu.id
       ORDER BY total_recaudado DESC`,
      req.user.role === 'owner' ? [...params, req.user.id, req.user.id] : params
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

    // Para jefe_publicas: agregamos vista "zona" — todas las ventas de
    // promotors con la misma zona_id (excluyendo las propias del jefe).
    // Antes filtrabamos por leader_id (equipo directo), pero el alcance
    // del jefe es por zona, no por nominacion directa.
    let zonaSummary = { rows: [{ zona_vendidas: 0, zona_recaudado: 0, mi_comision_jefe: 0 }] };
    if (req.user.role === 'jefe_publicas' && promo.zona_id) {
      zonaSummary = await db.query(
        `SELECT
           COUNT(CASE WHEN t.status IN ('pagado','usado') THEN t.id END) AS zona_vendidas,
           SUM(CASE WHEN t.status IN ('pagado','usado') THEN t.amount_paid ELSE 0 END) AS zona_recaudado,
           SUM(CASE WHEN t.status IN ('pagado','usado') THEN p.leader_commission ELSE 0 END) AS mi_comision_jefe
         FROM tickets t
         JOIN promotors p ON p.id = t.promotor_id
         WHERE p.zona_id = ? AND p.id != ?`,
        [promo.zona_id, promo.id]
      );
    }

    const ownTotal = summary.rows[0].total_recaudado || 0;
    const ownComm  = summary.rows[0].mi_comision || 0;
    const teamComm = zonaSummary.rows[0].mi_comision_jefe || 0;
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
        // Métricas de zona (solo aplica al jefe). Para vendedor son 0.
        zona_vendidas:  zonaSummary.rows[0].zona_vendidas || 0,
        zona_recaudado: zonaSummary.rows[0].zona_recaudado || 0,
        mi_comision_jefe: teamComm,
        es_jefe: req.user.role === 'jefe_publicas',
        // Compat: legacy "equipo_vendidas" mapeado a zona para no romper UI.
        equipo_vendidas: zonaSummary.rows[0].zona_vendidas || 0,
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
    // Owner solo puede modificar comisión de SU staff.
    if (req.user.role === 'owner') {
      const u = await db.query('SELECT created_by FROM users WHERE id = ?', [req.params.id]);
      const cb = u.rows[0]?.created_by;
      if (!cb) return res.status(403).json({ error: 'Sin acceso a este usuario' });
      if (cb !== req.user.id) {
        // ¿el creador es jefe del owner?
        const jefe = await db.query('SELECT created_by FROM users WHERE id = ?', [cb]);
        if (jefe.rows[0]?.created_by !== req.user.id)
          return res.status(403).json({ error: 'Sin acceso a este usuario' });
      }
    }
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

module.exports = { getAll, create, update, deactivate, getPromoterSales, getMyPromoterSales, createTeamMember, getMyTeam, removeTeamMember, updateCommission };
