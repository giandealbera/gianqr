const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

let dbInstance = null;

const initDb = async () => {
  if (!dbInstance) {
    dbInstance = await open({
      filename: path.join(__dirname, '../../../database/gianqr.sqlite'),
      driver: sqlite3.Database
    });
    await dbInstance.run('PRAGMA foreign_keys = ON');
  }
  return dbInstance;
};

// Wrapper para imitar el comportamiento de mysql2
const query = async (text, params = []) => {
  const db = await initDb();
  // Reemplazar sintaxis específica de MySQL si fuera necesario
  // Ej: NOW() -> CURRENT_TIMESTAMP
  const cleanText = text.replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP');
  
  if (cleanText.trim().toUpperCase().startsWith('SELECT')) {
    const rows = await db.all(cleanText, params);
    return { rows };
  } else {
    const result = await db.run(cleanText, params);
    return { rows: [], insertId: result.lastID, affectedRows: result.changes };
  }
};

const pool = {
  getConnection: async () => {
    const db = await initDb();
    return {
      beginTransaction: async () => db.run('BEGIN'),
      commit: async () => db.run('COMMIT'),
      rollback: async () => db.run('ROLLBACK'),
      release: () => {},
      execute: async (text, params = []) => {
        const cleanText = text.replace(/NOW\(\)/gi, 'CURRENT_TIMESTAMP');
        if (cleanText.trim().toUpperCase().startsWith('SELECT')) {
          const rows = await db.all(cleanText, params);
          return [rows];
        } else {
          const result = await db.run(cleanText, params);
          return [[], result];
        }
      }
    };
  }
};

module.exports = { query, pool, initDb };
