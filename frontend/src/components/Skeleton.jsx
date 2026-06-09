// Bloque animado con shimmer suave. Tailwind nativo no tiene shimmer asi
// que lo hacemos con un gradiente y animate-pulse. Se ve sutil sobre el
// fondo dark. Usar como reemplazo del spinner en listas mientras carga
// la data: el usuario percibe la "forma" del contenido que viene y la
// transicion a data real se siente instantanea.

const Skeleton = ({ className = '', style }) => (
  <div
    className={`animate-pulse rounded-lg ${className}`}
    style={{
      background: 'linear-gradient(90deg, #161B24 0%, #1E2530 50%, #161B24 100%)',
      ...style,
    }}
  />
);

// Item-fila tipo lista (eventos, tickets, etc). Imita la altura real del
// card final para no causar layout shift cuando llega la data.
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

export default Skeleton;
