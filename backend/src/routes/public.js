const express = require('express');
const router  = express.Router();
const { getPublicEvents, getPromoterInfo, createPublicTicket, recoverTickets } = require('../controllers/publicController');

router.get('/events',         getPublicEvents);
router.get('/promotor/:code', getPromoterInfo);
router.post('/tickets/:code', createPublicTicket);
router.post('/recover/:code', recoverTickets);

module.exports = router;
