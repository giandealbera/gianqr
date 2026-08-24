const express = require('express');
const { asyncRouter } = require('../utils/asyncRouter');
const router  = asyncRouter(express.Router());
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { listar } = require('../controllers/newsletterController');

// Lista de suscriptores para exportar. Solo admin y owner: es la base de
// contactos del organizador. El controller acota a los eventos del usuario.
router.get('/', auth, roles('admin', 'owner'), listar);

module.exports = router;
