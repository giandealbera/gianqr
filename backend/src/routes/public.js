const express = require('express');
const router  = express.Router();
const { publicBuyLimiter, publicRecoverLimiter, publicTicketsInfoLimiter } = require('../middleware/rateLimiters');
const {
  getPublicEvents, getPromoterInfo, createPublicTicket, recoverTickets,
  getReservedTickets, completeReservedTickets, getLocalidadesSuggestions,
} = require('../controllers/publicController');

router.get('/events',         getPublicEvents);
router.get('/promotor/:code', getPromoterInfo);
router.post('/tickets/:code', publicBuyLimiter,     createPublicTicket);
router.post('/recover/:code', publicRecoverLimiter, recoverTickets);

// Reservas (link generado desde /caja). El comprador completa nombre/apellido.
router.get('/tickets-info',            publicTicketsInfoLimiter, getReservedTickets);
router.post('/tickets-complete/:code', publicBuyLimiter,         completeReservedTickets);

// Autocompletado de ciudades (no expone PII, solo nombres de ciudades).
router.get('/localidades', getLocalidadesSuggestions);

module.exports = router;
