const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let dbInstance = null;

const DB_PATH = path.join(__dirname, '../../../database/gianqr.sqlite');

const initDb = async () => {
  if (!dbInstance) {
    // Asegurar que el directorio exista
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    dbInstance = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });
    await dbInstance.run('PRAGMA journal_mode = WAL');
    await dbInstance.run('PRAGMA foreign_keys = ON');

    // Auto-crear tablas si no existen
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        email        TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role         TEXT NOT NULL DEFAULT 'cajero',
        is_active    INTEGER NOT NULL DEFAULT 1,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS promotors (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL,
        promo_code  TEXT NOT NULL UNIQUE,
        commission  REAL DEFAULT 0.00,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS venues (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        capacity    INTEGER NOT NULL DEFAULT 200,
        description TEXT,
        is_active   INTEGER NOT NULL DEFAULT 1,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS events (
        id           TEXT PRIMARY KEY,
        venue_id     TEXT,
        name         TEXT NOT NULL,
        description  TEXT,
        date         TEXT NOT NULL,
        start_time   TEXT NOT NULL,
        end_time     TEXT,
        flyer_url    TEXT,
        is_active    INTEGER NOT NULL DEFAULT 1,
        created_by   TEXT,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS ticket_types (
        id           TEXT PRIMARY KEY,
        event_id     TEXT NOT NULL,
        name         TEXT NOT NULL,
        price        REAL NOT NULL DEFAULT 0.00,
        total_quota  INTEGER NOT NULL,
        sold_count   INTEGER NOT NULL DEFAULT 0,
        is_active    INTEGER NOT NULL DEFAULT 1,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id             TEXT PRIMARY KEY,
        ticket_type_id TEXT NOT NULL,
        event_id       TEXT NOT NULL,
        buyer_name     TEXT NOT NULL,
        buyer_email    TEXT NOT NULL,
        buyer_dni      TEXT,
        qr_code        TEXT NOT NULL UNIQUE,
        payment_method TEXT NOT NULL,
        payment_ref    TEXT,
        amount_paid    REAL NOT NULL DEFAULT 0.00,
        status         TEXT NOT NULL DEFAULT 'pendiente',
        promotor_id    TEXT,
        scanned_at     DATETIME,
        scanned_by     TEXT,
        sold_by        TEXT,
        created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id),
        FOREIGN KEY (event_id)       REFERENCES events(id),
        FOREIGN KEY (promotor_id)    REFERENCES promotors(id) ON DELETE SET NULL,
        FOREIGN KEY (scanned_by)     REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (sold_by)        REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS payments (
        id          TEXT PRIMARY KEY,
        ticket_id   TEXT NOT NULL,
        method      TEXT NOT NULL,
        amount      REAL NOT NULL,
        status      TEXT NOT NULL DEFAULT 'pendiente',
        external_id TEXT,
        external_data TEXT,
        notes       TEXT,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tickets_event_id    ON tickets(event_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_status      ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_tickets_buyer_email ON tickets(buyer_email);
      CREATE INDEX IF NOT EXISTS idx_events_date         ON events(date);
      CREATE INDEX IF NOT EXISTS idx_ticket_types_event  ON ticket_types(event_id);
      CREATE INDEX IF NOT EXISTS idx_payments_ticket     ON payments(ticket_id);
    `);

    // Añadir columnas para Jefes de Grupo y comisiones fijas si no existen
    try { await dbInstance.exec('ALTER TABLE promotors ADD COLUMN leader_id TEXT REFERENCES users(id) ON DELETE SET NULL'); } catch(e) {}
    try { await dbInstance.exec('ALTER TABLE promotors ADD COLUMN leader_commission REAL DEFAULT 400.00'); } catch(e) {}
  }
  return dbInstance;
};

/**
 * Ejecuta una query. Reemplaza NOW() por CURRENT_TIMESTAMP para compat MySQL.
 * Retorna { rows } para SELECTs, { rows: [], insertId, affectedRows } para escrituras.
 */
const query = async (text, params = []) => {
  const db = await initDb();
  const cleanText = text
    .replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/INSERT IGNORE INTO/gi, 'INSERT OR IGNORE INTO');

  if (cleanText.trim().toUpperCase().startsWith('SELECT')) {
    const rows = await db.all(cleanText, params);
    return { rows };
  } else {
    const result = await db.run(cleanText, params);
    return { rows: [], insertId: result.lastID, affectedRows: result.changes };
  }
};

/**
 * Ejecuta una transacción: recibe un callback async que recibe un objeto conn
 * con los métodos execute() y query() — imita la API de mysql2.
 */
const transaction = async (callback) => {
  const db = await initDb();
  try {
    await db.run('BEGIN');
    const conn = {
      execute: async (text, params = []) => {
        const cleanText = text
          .replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP')
          .replace(/ FOR UPDATE/gi, '')
          .replace(/INSERT IGNORE INTO/gi, 'INSERT OR IGNORE INTO');
        if (cleanText.trim().toUpperCase().startsWith('SELECT')) {
          const rows = await db.all(cleanText, params);
          return [rows];
        } else {
          const result = await db.run(cleanText, params);
          return [[], result];
        }
      },
      query: async (text, params = []) => {
        return await query(text, params);
      }
    };
    const result = await callback(conn);
    await db.run('COMMIT');
    return result;
  } catch (err) {
    await db.run('ROLLBACK');
    throw err;
  }
};

module.exports = { query, initDb, transaction };
