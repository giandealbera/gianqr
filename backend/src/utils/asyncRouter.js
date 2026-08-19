/**
 * Router que no deja caer el servidor por una excepcion en un handler async.
 *
 * El problema: en Express 4, si un handler `async` lanza fuera de su try/catch,
 * la promesa queda rechazada y Express NO la ve. Node la reporta como
 * unhandledRejection y, desde la v15, MATA EL PROCESO.
 *
 * No es teorico: un POST publico a /public/tickets/:code con
 * `attendees: [null]` tiraba TypeError en la validacion y se llevaba puesto
 * el backend entero. Cualquiera en internet dejaba sin sistema a todos —
 * porteros sin poder escanear, compradores sin poder comprar— con un pedido.
 *
 * Envolver cada handler y mandar el error a next() lo convierte en un 500
 * normal, atendido por el manejador de errores de server.js.
 *
 * Uso: const router = asyncRouter(express.Router());
 */

// Los middlewares de manejo de errores tienen 4 argumentos (err, req, res,
// next). Envolverlos romperia su firma, asi que los dejamos pasar.
function envolver(fn) {
  if (typeof fn !== 'function' || fn.length === 4) return fn;
  return function (req, res, next) {
    try {
      return Promise.resolve(fn.call(this, req, res, next)).catch(next);
    } catch (err) {
      // Un throw sincronico Express ya lo maneja, pero lo unificamos.
      return next(err);
    }
  };
}

const METODOS = ['get', 'post', 'put', 'patch', 'delete', 'all', 'use'];

function asyncRouter(router) {
  for (const metodo of METODOS) {
    const original = router[metodo].bind(router);
    router[metodo] = (...args) =>
      original(...args.map(a => (typeof a === 'function' ? envolver(a) : a)));
  }
  return router;
}

module.exports = { asyncRouter };
