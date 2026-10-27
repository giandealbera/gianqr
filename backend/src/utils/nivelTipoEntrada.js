/**
 * Quien puede generar cada tipo de entrada.
 *
 * Cada ticket_type tiene un NIVEL MINIMO (min_role). Quien esta en ese nivel
 * o mas arriba lo puede generar; quien esta mas abajo, no:
 *
 *   marcada como        dueño   jefe   vendedor
 *   ------------------  -----   ----   --------
 *   dueño                 si     no       no
 *   jefe_publicas         si     si       no
 *   vendedor              si     si       si
 *
 * Default 'vendedor' = abierto a todos, que es como se comportaba el sistema
 * antes de existir esta columna. Por eso agregarla no cambia nada de lo que
 * ya estaba cargado.
 *
 * Convive con ticket_type_sellers (la lista de personas puntuales): son dos
 * filtros distintos y se aplican los DOS. El nivel dice "de jefe para
 * arriba"; la lista dice "ademas, solo estos tres jefes". Pasar uno no
 * saltea el otro.
 */
const db = require('../config/database');

// admin esta arriba de todo: es el dueño del sistema, no de un evento.
const RANGO = { vendedor: 1, jefe_publicas: 2, owner: 3, admin: 4 };

// Los unicos valores que puede tomar min_role. No incluye 'admin': no tiene
// sentido un tipo de entrada que el dueño del evento no pueda generar.
const NIVELES = ['vendedor', 'jefe_publicas', 'owner'];

const ETIQUETA = {
  vendedor:      'Todos (vendedores, jefes y dueño)',
  jefe_publicas: 'Jefes de públicas y dueño',
  owner:         'Solo el dueño',
};

function esNivelValido(v) {
  return NIVELES.includes(v);
}

/** Normaliza lo que venga del cliente a un nivel valido. */
function normalizarNivel(v) {
  return esNivelValido(v) ? v : 'vendedor';
}

/** ¿El rol alcanza el nivel minimo pedido? */
function alcanzaNivel(rol, minRole) {
  const mio    = RANGO[rol] || 0;
  const pedido = RANGO[normalizarNivel(minRole)];
  return mio >= pedido;
}

/**
 * Chequeo completo para emitir una entrada de un tipo: nivel + lista de
 * vendedores habilitados.
 *
 * Existe como funcion unica a proposito. Antes cada camino de venta repetia
 * el chequeo de la lista por su cuenta, y la venta manual (POST /tickets) se
 * lo habia salteado: un vendedor podia emitir por ahi un tipo que el dueño
 * no le habia habilitado. Con un solo lugar, agregar un camino nuevo no
 * vuelve a abrir el agujero.
 *
 * @param {object} user          { id, role }
 * @param {string} ticketTypeId
 * @param {string} [userIdParaLista]  a quien chequear en la lista de
 *        habilitados. En la compra publica el que vende es el promotor del
 *        link, no quien hace el request (que es un comprador anonimo).
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
async function puedeEmitirTipo(user, ticketTypeId, userIdParaLista = user?.id) {
  const r = await db.query('SELECT min_role FROM ticket_types WHERE id = ?', [ticketTypeId]);
  if (!r.rows[0]) return { ok: false, error: 'Tipo de entrada no encontrado' };

  const minRole = normalizarNivel(r.rows[0].min_role);
  if (!alcanzaNivel(user?.role, minRole)) {
    return { ok: false, error: `Este tipo de entrada lo puede generar: ${ETIQUETA[minRole].toLowerCase()}.` };
  }

  // La lista de personas solo restringe a jefes y vendedores. El dueño y el
  // admin no se listan nunca.
  if (['jefe_publicas', 'vendedor'].includes(user?.role)) {
    const rest = await db.query(
      'SELECT 1 FROM ticket_type_sellers WHERE ticket_type_id = ? LIMIT 1', [ticketTypeId]
    );
    if (rest.rows.length > 0) {
      const ok = await db.query(
        'SELECT 1 FROM ticket_type_sellers WHERE ticket_type_id = ? AND user_id = ? LIMIT 1',
        [ticketTypeId, userIdParaLista]
      );
      if (!ok.rows[0]) return { ok: false, error: 'Este tipo de entrada no está habilitado para vos.' };
    }
  }

  return { ok: true };
}

module.exports = { RANGO, NIVELES, ETIQUETA, esNivelValido, normalizarNivel, alcanzaNivel, puedeEmitirTipo };
