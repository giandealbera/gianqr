const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// GET /api/proveedores
const list = async (req, res) => {
  const { search } = req.query;
  try {
    const params = [];
    let where = '';
    if (search) {
      where = `WHERE nombre LIKE ? OR apellido LIKE ? OR alias_cbu LIKE ? OR notas LIKE ?`;
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
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
    await db.query(
      `INSERT INTO proveedores (id, nombre, apellido, alias_cbu, notas)
       VALUES (?,?,?,?,?)`,
      [id, nombre.trim(), (apellido || '').trim() || null, (alias_cbu || '').trim() || null, (notas || '').trim() || null]
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
    await db.query('DELETE FROM proveedores WHERE id = ?', [req.params.id]);
    res.json({ message: 'Proveedor eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar proveedor' });
  }
};

module.exports = { list, create, update, remove };
