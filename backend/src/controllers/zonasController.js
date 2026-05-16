const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// GET /api/zonas — lista con conteo de publicas asignadas
const list = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT z.id, z.name, z.created_at,
              COUNT(p.id) AS publicas_count
       FROM zonas z
       LEFT JOIN promotors p ON p.zona_id = z.id
       GROUP BY z.id
       ORDER BY z.name ASC`
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
    await db.query('INSERT INTO zonas (id, name) VALUES (?,?)', [id, name]);
    res.status(201).json({ id, name });
  } catch (err) {
    if (err.message?.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Ya existe una zona con ese nombre' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear zona' });
  }
};

// PUT /api/zonas/:id
const update = async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
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
    await db.query('DELETE FROM zonas WHERE id = ?', [req.params.id]);
    res.json({ message: 'Zona eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error al eliminar zona' });
  }
};

module.exports = { list, create, update, remove };
