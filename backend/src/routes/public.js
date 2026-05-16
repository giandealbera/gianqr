const express = require('express');
const router  = express.Router();
const { publicBuyLimiter, publicRecoverLimiter } = require('../middleware/rateLimiters');
const { getPublicEvents, getPromoterInfo, createPublicTicket, recoverTickets } = require('../controllers/publicController');

router.get('/events',         getPublicEvents);
router.get('/promotor/:code', getPromoterInfo);
router.post('/tickets/:code', publicBuyLimiter,     createPublicTicket);
router.post('/recover/:code', publicRecoverLimiter, recoverTickets);

module.exports = router;
