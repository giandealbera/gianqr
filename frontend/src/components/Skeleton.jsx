/**
 * Esqueletos de carga.
 *
 * Reemplazan al spinner en las pantallas que cargan contenido. Un spinner
 * dice "esperá" y nada mas; un esqueleto muestra la forma de lo que viene,
 * asi la pantalla no salta cuando llegan los datos y la espera se siente mas
 * corta. Es de las diferencias mas marcadas entre una web y una app.
 *
 * Regla: el esqueleto tiene que parecerse a lo que va a aparecer. Uno
 * generico en una pantalla de tarjetas se nota igual de postizo que un
 * spinner — por eso hay varias formas y cada pantalla usa la suya.
 *
 * El spinner sigue siendo lo correcto en tres casos, y ahi se deja: arranque
 * de la app, verificacion de un token, y adentro de un boton que se aprieta.
 */

// Bloque base. El brillo que lo recorre vive en index.css (.skeleton), para
// poder apagarlo entero con prefers-reduced-motion.
export const Skeleton = ({ className = '', style }) => (
  <div className={`skeleton rounded-lg ${className}`} style={style} aria-hidden="true" />
);

// Item-fila tipo lista (tickets vendidos, etc). Imita la altura real del card
// final para no causar salto de layout cuando llega la data.
export const SkeletonRow = () => (
  <div className="card flex items-center justify-between gap-3 py-3 mb-2">
    <div className="min-w-0 flex-1 space-y-2">
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-2/5" />
    </div>
    <div className="shrink-0 space-y-2 text-right">
      <Skeleton className="h-4 w-16 ml-auto" />
      <Skeleton className="h-3 w-20 ml-auto" />
    </div>
  </div>
);

// Card de evento (mas alto, con titulo + meta + numero a la derecha).
export const SkeletonEventCard = () => (
  <div className="card flex items-start justify-between gap-3 mb-3">
    <div className="min-w-0 flex-1 space-y-2.5">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-5 w-24 rounded-full" />
    </div>
    <div className="text-right shrink-0 space-y-2">
      <Skeleton className="h-6 w-10 ml-auto" />
      <Skeleton className="h-2 w-14 ml-auto" />
    </div>
  </div>
);

// Lista de filas.
export const SkeletonList = ({ rows = 5 }) => (
  <div>
    {Array.from({ length: rows }, (_, i) => <SkeletonRow key={i} />)}
  </div>
);

// Tarjetas de numero grande (recaudado, vendidas, etc).
export const SkeletonStats = ({ cards = 4 }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    {Array.from({ length: cards }, (_, i) => (
      <div key={i} className="card">
        <Skeleton className="h-2.5 w-3/5 mb-3" />
        <Skeleton className="h-7 w-3/4" />
      </div>
    ))}
  </div>
);

// Tabla: encabezado + filas.
export const SkeletonTable = ({ rows = 6, cols = 3 }) => (
  <div className="card p-0 overflow-hidden">
    <div className="px-4 py-3 border-b" style={{ borderColor: '#2B312E' }}>
      <Skeleton className="h-3 w-1/3" />
    </div>
    <div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5 border-t"
             style={{ borderColor: '#2B312E' }}>
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton
              key={c}
              className="h-3"
              // Anchos distintos por columna: una grilla perfecta es lo que
              // mas delata que el esqueleto es de mentira.
              style={{ flex: c === 0 ? '2 1 0' : '1 1 0', maxWidth: c === 0 ? 'none' : '80px' }}
            />
          ))}
        </div>
      ))}
    </div>
  </div>
);

// Tablero completo: numeros arriba, lista abajo.
export const SkeletonPantalla = ({ stats = 4, rows = 4 }) => (
  <div className="space-y-4">
    {stats > 0 && <SkeletonStats cards={stats} />}
    {rows > 0 && <SkeletonList rows={rows} />}
  </div>
);

export default Skeleton;
