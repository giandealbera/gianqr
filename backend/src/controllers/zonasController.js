const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// Multi-tenant: owner ve y modifica SOLO las zonas que el creo
// (created_by = owner.id). Admin ve todas. Jefe lee globales para
// asignar al crear vendedor.
const ownerScopeWhere = (req) =>
  req.user.role === 'owner' ? 'WHERE z.created_by = ?' : '';
const ownerScopeParams = (req) =>
  req.user.role === 'owner' ? [req.user.id] : [];

// GET /api/zonas — lista con conteo de publicas asignadas
const list = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT z.id, z.name, z.created_at,
              COUNT(p.id) AS publicas_count
       FROM zonas z
       LEFT JOIN promotors p ON p.zona_id = z.id
       ${ownerScopeWhere(req)}
       GROUP BY z.id
       ORDER BY z.name ASC`,
      ownerScopeParams(req)
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener zonas' });
  }
};

// POST /api/zonas
const create = async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const id = uuidv4();
    const createdBy = req.user.role === 'owner' ? req.user.id : null;
    await db.query('INSERT INTO zonas (id, name, created_by) VALUES (?,?,?)', [id, name, createdBy]);
    res.status(201).json({ id, name });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Ya existe una zona con ese nombre' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear zona' });
  }
};

// Helper: owner solo puede modificar zonas que el creo
async function ownerCanEdit(req, zonaId) {
  if (req.user.role !== 'owner') return true;
  const r = await db.query('SELECT created_by FROM zonas WHERE id = ?', [zonaId]);
  if (!r.rows[0]) return false;
  return r.rows[0].created_by === req.user.id;
}

// PUT /api/zonas/:id
const update = async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    if (!(await ownerCanEdit(req, req.params.id)))
      return res.status(403).json({ error: 'No tenés acceso a esta zona' });
    await db.query('UPDATE zonas SET name=? WHERE id=?', [name, req.params.id]);
    res.json({ id: req.params.id, name });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Ya existe una zona con ese nombre' });
    }
    res.status(500).json({ error: 'Error al actualizar zona' });
  }
};

// DELETE /api/zonas/:id — los promotors quedan con zona_id NULL (FK ON DELETE SET NULL)
const remove = async (req, res) => {
  try {
    if (!(await ownerCanEdit(req, req.params.id)))
      return res.status(403).json({ error: 'No tenés acceso a esta zona' });
    await db.query('DELETE FROM zonas WHERE id = ?', [req.params.id]);
    res.json({ message: 'Zona eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar zona' });
  }
};

module.exports = { list, create, update, remove };
