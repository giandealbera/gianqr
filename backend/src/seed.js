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
    // Verificar si ya existe el admin
    const existing = await db.query("SELECT id FROM users WHERE email = 'admin@gianqr.com'");
    if (existing.rows.length > 0) return; // ya seedeado

    // Crear admin
    const hash = await bcrypt.hash('Admin1234!', 10);
    await db.query(
      "INSERT INTO users (id, name, email, password_hash, role) VALUES (?,?,?,?,?)",
      [uuidv4(), 'Administrador', 'admin@gianqr.com', hash, 'admin']
    );

    // Crear sala por defecto si no existe
    const venues = await db.query("SELECT id FROM venues LIMIT 1");
    if (venues.rows.length === 0) {
      await db.query(
        "INSERT INTO venues (id, name, capacity, description) VALUES (?,?,?,?)",
        [uuidv4(), 'Pista Principal', 500, 'Sala principal del boliche']
      );
    }

    console.log('✅ Seed completado: admin@gianqr.com / Admin1234!');
  } catch (err) {
    console.error('❌ Error en seed:', err.message);
  }
}

module.exports = seed;
