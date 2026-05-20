const { initDb } = require('./config/database');

const run = async () => {
  const db = await initDb();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      email        TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'admin',
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

  console.log('Base de datos SQLite inicializada.');
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
