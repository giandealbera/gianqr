require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { initDb } = require('./src/config/database');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth',     require('./src/routes/auth'));
app.use('/api/users',    require('./src/routes/users'));
app.use('/api/events',   require('./src/routes/events'));
app.use('/api/tickets',  require('./src/routes/tickets'));
app.use('/api/payments', require('./src/routes/payments'));

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', sistema: 'GianQR', version: '1.0.0' })
);

app.use((req, res) => res.status(404).json({ error: `Ruta no encontrada: ${req.path}` }));
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4000;

const start = async () => {
  // Inicializar la base de datos SQLite (crea tablas si no existen)
  await initDb();
  console.log('  ✅ Base de datos SQLite lista');

  // Ejecutar seed (crea admin y sala por defecto)
  try { await require('./src/seed')(); } catch(e) { /* ya seedeado */ }

  app.listen(PORT, () => {
    console.log(`
  ╔════════════════════════════════╗
  ║   🎵  GianQR Backend v1.0     ║
  ║   Puerto: ${PORT}                  ║
  ╚════════════════════════════════╝
    `);
  });
};

start().catch(err => {
  console.error('❌ Error al iniciar el servidor:', err);
  process.exit(1);
});

module.exports = app;
