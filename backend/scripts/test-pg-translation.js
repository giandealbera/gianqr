/**
 * Test de traducción SQLite -> Postgres del wrapper.
 * Corre con:  node scripts/test-pg-translation.js
 *
 * No conecta a ninguna DB; sólo imprime cómo queda cada query luego del translate.
 * Sirve para visualizar que las queries criticas (INSERT con ?, transactions, etc.)
 * salen bien antes de apuntar a un Postgres real.
 */

// Importamos la función translateForPostgres del wrapper. No esta exportada,
// la cargamos haciendo require y leyendo el .toString() o re-implementamos aca.
// Mejor: la copio aca exactamente igual y la usamos.

function translateForPostgres(text) {
  let out = text;
  const hadIgnore = /\bINSERT\s+(OR\s+)?IGNORE\s+INTO\b/i.test(out);
  out = out.replace(/\bINSERT\s+(OR\s+)?IGNORE\s+INTO\b/gi, 'INSERT INTO');
  out = out.replace(/\bDATETIME\b/gi, 'TIMESTAMP');
  let n = 0;
  out = out.replace(/\?/g, () => `$${++n}`);
  if (hadIgnore && !/\bON\s+CONFLICT\b/i.test(out)) {
    out = out.trimEnd().replace(/;$/, '') + ' ON CONFLICT DO NOTHING';
  }
  return out;
}

const cases = [
  {
    name: 'login query',
    sql: 'SELECT * FROM users WHERE email = ? AND is_active = 1',
  },
  {
    name: 'insert user',
    sql: 'INSERT INTO users (id, name, email, password_hash, role) VALUES (?,?,?,?,?)',
  },
  {
    name: 'insert promotor con OR IGNORE (deberia agregar ON CONFLICT)',
    sql: 'INSERT OR IGNORE INTO promotors (id, user_id, promo_code) VALUES (?,?,?)',
  },
  {
    name: 'insert con IGNORE legacy mysql',
    sql: 'INSERT IGNORE INTO scanner_tokens (id, token) VALUES (?,?)',
  },
  {
    name: 'CREATE TABLE con DATETIME',
    sql: `CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      sale_start_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
  },
  {
    name: 'rendiciones list con search + event_id (muchos ?)',
    sql: `SELECT p.id, COUNT(t.id) AS total
          FROM promotors p
          LEFT JOIN tickets t ON t.promotor_id = p.id AND t.event_id = ?
          WHERE 1=1 AND (u.name LIKE ? OR u.apellido LIKE ?)
          GROUP BY p.id`,
  },
  {
    name: 'update con multiples ?',
    sql: 'UPDATE users SET name=?, email=?, role=?, is_active=? WHERE id=?',
  },
  {
    name: 'subquery con ?',
    sql: `SELECT p.id,
                 (SELECT COALESCE(SUM(amount),0) FROM rendiciones WHERE promotor_id = p.id AND event_id = ?) AS pagado
          FROM promotors p
          WHERE p.id = ?`,
  },
  {
    name: 'CURRENT_TIMESTAMP en SET',
    sql: 'UPDATE proveedores SET nombre=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
  },
];

for (const c of cases) {
  console.log('---');
  console.log('CASO:', c.name);
  console.log('IN: ', c.sql.trim().replace(/\s+/g, ' '));
  console.log('OUT:', translateForPostgres(c.sql).trim().replace(/\s+/g, ' '));
}
