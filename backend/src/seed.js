/**
 * GianQR - Seed inicial
 * Crea el usuario admin y sala por defecto si no existen.
 * Se ejecuta automáticamente al arrancar el servidor.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./config/database');

async function seed() {
  try {
    // Crear/actualizar admin
    let adminId;
    const existingAdmin = await db.query("SELECT id FROM users WHERE email = 'admin'");
    if (existingAdmin.rows.length === 0) {
      // Borrar admin viejo si existe
      await db.query("DELETE FROM users WHERE email = 'admin@gianqr.com'");
      const hash = await bcrypt.hash('admin123', 10);
      adminId = uuidv4();
      await db.query(
        "INSERT INTO users (id, name, email, password_hash, role) VALUES (?,?,?,?,?)",
        [adminId, 'Administrador', 'admin', hash, 'admin']
      );
      console.log('✅ Admin creado: admin / admin123');
    } else {
      adminId = existingAdmin.rows[0].id;
    }

    // Garantizar promotor "CASA" asociado al admin (para que la caja pueda generar links)
    const casaRow = await db.query("SELECT id FROM promotors WHERE promo_code = 'CASA'");
    if (casaRow.rows.length === 0) {
      await db.query(
        "INSERT INTO promotors (id, user_id, promo_code, commission, leader_commission) VALUES (?,?,?,?,?)",
        [uuidv4(), adminId, 'CASA', 0, 0]
      );
      console.log('✅ Promotor CASA creado (caja interna)');
    }

    // Crear vendedor de ejemplo si no existe
    const existingVendedor = await db.query("SELECT id FROM users WHERE email = 'vendedor'");
    if (existingVendedor.rows.length === 0) {
      const hashV = await bcrypt.hash('vendedor123', 10);
      const vendedorId = uuidv4();
      await db.query(
        "INSERT INTO users (id, name, email, password_hash, role) VALUES (?,?,?,?,?)",
        [vendedorId, 'Vendedor', 'vendedor', hashV, 'vendedor']
      );
      await db.query(
        "INSERT OR IGNORE INTO promotors (id, user_id, promo_code, commission, leader_commission) VALUES (?,?,?,?,?)",
        [uuidv4(), vendedorId, 'VENDEDOR', 800, 400]
      );
      console.log('✅ Vendedor creado: vendedor / vendedor123');
    }

    // Crear sala por defecto si no existe
    const venues = await db.query("SELECT id FROM venues LIMIT 1");
    if (venues.rows.length === 0) {
      await db.query(
        "INSERT INTO venues (id, name, capacity, description) VALUES (?,?,?,?)",
        [uuidv4(), 'Pista Principal', 500, 'Sala principal del boliche']
      );
    }
  } catch (err) {
    console.error('❌ Error en seed:', err.message);
  }
}

module.exports = seed;
