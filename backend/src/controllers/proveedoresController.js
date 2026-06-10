const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// Multi-tenant: owner ve y modifica SOLO los proveedores que el creo.
// Admin ve todos.
const ownerScopeWhere = (req, prefix = '') =>
  req.user.role === 'owner' ? `${prefix}created_by = ?` : '';
const ownerScopeParams = (req) =>
  req.user.role === 'owner' ? [req.user.id] : [];

async function ownerCanEdit(req, id) {
  if (req.user.role !== 'owner') return true;
  const r = await db.query('SELECT created_by FROM proveedores WHERE id = ?', [id]);
  if (!r.rows[0]) return false;
  return r.rows[0].created_by === req.user.id;
}

// GET /api/proveedores
const list = async (req, res) => {
  const { search } = req.query;
  try {
    const params = [];
    const conds = [];
    if (search) {
      // LOWER en ambos lados → case-insensitive en PG y SQLite.
      conds.push(`(LOWER(nombre) LIKE LOWER(?) OR LOWER(apellido) LIKE LOWER(?) OR LOWER(alias_cbu) LIKE LOWER(?) OR LOWER(notas) LIKE LOWER(?))`);
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (req.user.role === 'owner') {
      conds.push('created_by = ?');
      params.push(req.user.id);
    }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT id, nombre, apellido, alias_cbu, notas, created_at, updated_at
       FROM proveedores ${where}
       ORDER BY nombre ASC, apellido ASC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
};

// POST /api/proveedores
const create = async (req, res) => {
  const { nombre, apellido, alias_cbu, notas } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  try {
    const id = uuidv4();
    const createdBy = req.user.role === 'owner' ? req.user.id : null;
    await db.query(
      `INSERT INTO proveedores (id, nombre, apellido, alias_cbu, notas, created_by)
       VALUES (?,?,?,?,?,?)`,
      [id, nombre.trim(), (apellido || '').trim() || null, (alias_cbu || '').trim() || null, (notas || '').trim() || null, createdBy]
    );
    const result = await db.query('SELECT * FROM proveedores WHERE id = ?', [id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
};

// PUT /api/proveedores/:id
const update = async (req, res) => {
  const { nombre, apellido, alias_cbu, notas } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }
  try {
    if (!(await ownerCanEdit(req, req.params.id)))
      return res.status(403).json({ error: 'No tenés acceso a este proveedor' });
    await db.query(
      `UPDATE proveedores SET nombre=?, apellido=?, alias_cbu=?, notas=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [nombre.trim(), (apellido || '').trim() || null, (alias_cbu || '').trim() || null, (notas || '').trim() || null, req.params.id]
    );
    const result = await db.query('SELECT * FROM proveedores WHERE id = ?', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Proveedor no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
};

// DELETE /api/proveedores/:id
const remove = async (req, res) => {
  try {
    if (!(await ownerCanEdit(req, req.params.id)))
      return res.status(403).json({ error: 'No tenés acceso a este proveedor' });
    await db.query('DELETE FROM proveedores WHERE id = ?', [req.params.id]);
    res.json({ message: 'Proveedor eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar proveedor' });
  }
};

module.exports = { list, create, update, remove };
