-- ============================================================
--  GianQR - Schema MySQL 8.0
--  Sistema de ventas QR para boliche
-- ============================================================

CREATE DATABASE IF NOT EXISTS gianqr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gianqr;

-- ============================================================
-- USUARIOS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id           CHAR(36) PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role         ENUM('admin','portero','promotor','jefe_publicas','vendedor') NOT NULL DEFAULT 'admin',
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS promotors (
  id          CHAR(36) PRIMARY KEY,
  user_id     CHAR(36) NOT NULL,
  promo_code  VARCHAR(20) NOT NULL UNIQUE,
  commission  DECIMAL(5,2) DEFAULT 0.00,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- SALAS / VENUES
-- ============================================================

CREATE TABLE IF NOT EXISTS venues (
  id          CHAR(36) PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  capacity    INT NOT NULL DEFAULT 200,
  description TEXT,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- EVENTOS
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id           CHAR(36) PRIMARY KEY,
  venue_id     CHAR(36),
  name         VARCHAR(150) NOT NULL,
  description  TEXT,
  date         DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME,
  flyer_url    TEXT,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_by   CHAR(36),
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- TIPOS DE ENTRADA
-- ============================================================

CREATE TABLE IF NOT EXISTS ticket_types (
  id           CHAR(36) PRIMARY KEY,
  event_id     CHAR(36) NOT NULL,
  name         VARCHAR(80) NOT NULL,
  price        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_quota  INT NOT NULL,
  sold_count   INT NOT NULL DEFAULT 0,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- ============================================================
-- TICKETS / QR
-- ============================================================

CREATE TABLE IF NOT EXISTS tickets (
  id             CHAR(36) PRIMARY KEY,
  ticket_type_id CHAR(36) NOT NULL,
  event_id       CHAR(36) NOT NULL,
  buyer_name     VARCHAR(150) NOT NULL,
  buyer_email    VARCHAR(150) NOT NULL,
  buyer_dni      VARCHAR(20),
  qr_code        VARCHAR(100) NOT NULL UNIQUE,
  payment_method ENUM('mercadopago','efectivo','transferencia') NOT NULL,
  payment_ref    VARCHAR(200),
  amount_paid    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status         ENUM('pendiente','pagado','usado','cancelado') NOT NULL DEFAULT 'pendiente',
  promotor_id    CHAR(36),
  scanned_at     DATETIME,
  scanned_by     CHAR(36),
  sold_by        CHAR(36),
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id),
  FOREIGN KEY (event_id)       REFERENCES events(id),
  FOREIGN KEY (promotor_id)    REFERENCES promotors(id) ON DELETE SET NULL,
  FOREIGN KEY (scanned_by)     REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (sold_by)        REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- PAGOS
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
  id          CHAR(36) PRIMARY KEY,
  ticket_id   CHAR(36) NOT NULL,
  method      ENUM('mercadopago','efectivo','transferencia') NOT NULL,
  amount      DECIMAL(10,2) NOT NULL,
  status      ENUM('pendiente','aprobado','rechazado','reembolsado') NOT NULL DEFAULT 'pendiente',
  external_id VARCHAR(200),
  external_data JSON,
  notes       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_tickets_event_id    ON tickets(event_id);
CREATE INDEX idx_tickets_status      ON tickets(status);
CREATE INDEX idx_tickets_buyer_email ON tickets(buyer_email);
CREATE INDEX idx_events_date         ON events(date);
CREATE INDEX idx_ticket_types_event  ON ticket_types(event_id);
CREATE INDEX idx_payments_ticket     ON payments(ticket_id);

-- ============================================================
-- TRIGGER: incrementar sold_count al pagar ticket
-- ============================================================

DELIMITER $$

CREATE TRIGGER trg_ticket_sold_count
AFTER UPDATE ON tickets
FOR EACH ROW
BEGIN
  IF NEW.status = 'pagado' AND OLD.status != 'pagado' THEN
    UPDATE ticket_types SET sold_count = sold_count + 1 WHERE id = NEW.ticket_type_id;
  END IF;
END$$

DELIMITER ;

-- ============================================================
-- DATOS INICIALES
-- ============================================================

-- Sala por defecto
INSERT INTO venues (id, name, capacity, description)
VALUES (UUID(), 'Pista Principal', 500, 'Sala principal del boliche');

-- Admin por defecto
-- password: Admin1234!  (hasheado con bcrypt en el seed)
-- NOTA: el hash real se genera con Node.js al arrancar el servidor
INSERT INTO users (id, name, email, password_hash, role)
VALUES (
  UUID(),
  'Administrador',
  'admin@gianqr.com',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'admin'
);
-- Nota: el hash de arriba corresponde a 'password' de ejemplo.
-- El seed real se ejecuta automáticamente al iniciar el backend.
