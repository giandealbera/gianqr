const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { getAll, create, update, deactivate, hardDelete, getPromoterSales, getMyPromoterSales, createTeamMember, getMyTeam, removeTeamMember, updateCommission } = require('../controllers/usersController');

// Ventas de publicas (admin: todas / owner: solo de sus eventos)
router.get('/promoter-sales', auth, roles('admin', 'owner'), getPromoterSales);

// Mis ventas (jefe / vendedor / admin)
router.get('/my-sales', auth, roles('admin', 'jefe_publicas', 'vendedor'), getMyPromoterSales);

// Jefe gestiona su equipo
router.get('/my-team',     auth, roles('jefe_publicas'), getMyTeam);
router.post('/team',       auth, roles('jefe_publicas'), createTeamMember);
router.delete('/team/:id', auth, roles('jefe_publicas'), removeTeamMember);

// CRUD usuarios. Admin = todos. Owner = ve y gestiona SU staff (jefes/vendedores
// que se asignan a sus eventos). El controller filtra.
router.get('/',                   auth, roles('admin', 'owner'), getAll);
router.post('/',                  auth, roles('admin', 'owner'), create);
router.put('/:id',                auth, roles('admin', 'owner'), update);
router.patch('/:id/commission',   auth, roles('admin', 'owner'), updateCommission);
router.delete('/:id',             auth, roles('admin', 'owner'), deactivate);
// Hard delete: borra la fila de la DB. SOLO admin, con safeguards en el
// controller (no se puede borrar a si mismo ni al ultimo admin). Ruta
// explicita /hard para evitar borrado accidental por error de tipeo.
router.delete('/:id/hard',        auth, roles('admin'), hardDelete);

module.exports = router;
