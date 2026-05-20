const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const roles   = require('../middleware/roles');
const { getAll, create, update, deactivate, getPromoterSales, getMyPromoterSales, createTeamMember, getMyTeam, removeTeamMember, updateCommission } = require('../controllers/usersController');

// Ventas de todos los promotores (admin)
router.get('/promoter-sales', auth, roles('admin'), getPromoterSales);

// Mis ventas (jefe / vendedor / admin)
router.get('/my-sales', auth, roles('admin', 'jefe_publicas', 'vendedor'), getMyPromoterSales);

// Jefe gestiona su equipo
router.get('/my-team',     auth, roles('jefe_publicas'), getMyTeam);
router.post('/team',       auth, roles('jefe_publicas'), createTeamMember);
router.delete('/team/:id', auth, roles('jefe_publicas'), removeTeamMember);

router.get('/',                   auth, roles('admin'), getAll);
router.post('/',                  auth, roles('admin'), create);
router.put('/:id',                auth, roles('admin'), update);
router.patch('/:id/commission',   auth, roles('admin'), updateCommission);
router.delete('/:id',             auth, roles('admin'), deactivate);

module.exports = router;
