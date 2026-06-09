import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FixedSizeList as VirtualList } from 'react-window';
import api from '../../api/axios';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../../context/ConfirmContext';
import { SkeletonRow } from '../../components/Skeleton';
import toast from 'react-hot-toast';

const STATUS_BADGE = {
  pagado:    'bg-green-900 text-green-300',
  pendiente: 'bg-yellow-900 text-yellow-300',
  usado:     'bg-blue-900 text-blue-300',
  cancelado: 'bg-red-900 text-red-300',
};

const fmt = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n || 0);

// Altura fija por fila (px). Permite que react-window pre-calcule el scroll
// y solo monte ~15 filas visibles en lugar de las 5000 que podia haber antes.
const ROW_HEIGHT = 72;
const LIST_HEIGHT = 600; // viewport del scroller interno

// Row aislada y memoizada: react-window le pasa `index` y `style`. El
// `data` viene desde itemData (filteredTickets). Si solo cambia el scroll,
// las filas no re-renderizan.
const TicketRow = ({ index, style, data }) => {
  const t = data.items[index];
  return (
    <div style={style} className="px-1">
      <div className="card flex items-center justify-between gap-3 py-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{t.buyer_name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[t.status]}`}>
              {t.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {t.buyer_email} · {t.tipo_entrada}
          </p>
          <p className="text-[10px] text-gray-600 truncate mt-0.5">
            Generó: {t.generado_por || t.vendedor_nombre || 'Caja'}
            {t.vendedor_code ? ` (${t.vendedor_code})` : ''}
          </p>
        </div>
        <div className="text-right shrink-0 flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-green-400">{fmt(t.amount_paid)}</p>
            <p className="text-[10px] text-gray-600 font-mono">{t.qr_code}</p>
          </div>
          {data.onDelete && (
            <button
              onClick={() => data.onDelete(t)}
              className="text-xs text-red-400 hover:text-red-300 font-medium shrink-0"
              title="Eliminar entrada (libera el cupo)"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const SoldTickets = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const confirm = useConfirm();
  // Solo el dueño del evento puede exportar. El admin ve la pantalla
  // (por scope a su arbol) pero no descarga el Excel completo.
  const canExport = user?.role === 'owner';
  // Borrar entradas: dueño y admin (el backend revalida scope por ticket).
  const canDelete = ['owner', 'admin'].includes(user?.role);
  const [tickets, setTickets] = useState([]);
  const [event, setEvent]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [exporting, setExporting] = useState(false);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const { exportEventXlsx } = await import('../../utils/exportEventXlsx');
      const r = await exportEventXlsx(id);
      toast.success(`Excel descargado (${r.tickets} entradas)`);
    } catch (err) {
      console.error(err);
      toast.error('No se pudo generar el Excel');
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    Promise.all([
      api.get(`/events/${id}`),
      api.get(`/tickets?event_id=${id}`),
    ]).then(([ev, tk]) => {
      setEvent(ev.data);
      setTickets(tk.data);
    }).finally(() => setLoading(false));
  }, [id]);

  const handleDelete = useCallback(async (t) => {
    const ok = await confirm({
      title: 'Eliminar entrada',
      message: `Se va a borrar la entrada de ${t.buyer_name || 'comprador'}.\nEl cupo queda liberado y no se puede deshacer.`,
      confirmText: 'Eliminar',
      dangerous: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/tickets/${t.id}`);
      setTickets(prev => prev.filter(x => x.id !== t.id));
      toast.success('Entrada eliminada');
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.error || 'No se pudo eliminar');
    }
  }, [confirm]);

  // Filtros memoizados — sino se re-corren en cada keystroke incluso si
  // tickets no cambio (cuando el componente re-renderiza por otra razon).
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tickets.filter(t => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (!q) return true;
      return t.buyer_name?.toLowerCase().includes(q) ||
             t.buyer_email?.toLowerCase().includes(q) ||
             t.qr_code?.toLowerCase().includes(q) ||
             t.generado_por?.toLowerCase().includes(q) ||
             t.vendedor_nombre?.toLowerCase().includes(q) ||
             t.vendedor_code?.toLowerCase().includes(q);
    });
  }, [tickets, statusFilter, search]);

  // Totales sobre `filtered` memoizados. Una sola pasada para todos.
  const summary = useMemo(() => {
    let pagadas = 0, usadas = 0, revenue = 0;
    for (const t of tickets) {
      if (t.status === 'pagado') pagadas++;
      else if (t.status === 'usado') usadas++;
    }
    for (const t of filtered) {
      if (t.status === 'pagado' || t.status === 'usado') {
        revenue += parseFloat(t.amount_paid || 0);
      }
    }
    return { pagadas, usadas, revenue };
  }, [tickets, filtered]);

  // Threshold para activar el virtual list. Bajo eso, el render normal es
  // mas barato y permite usar el flow nativo del browser (zoom, find-in-page).
  const VIRT_THRESHOLD = 80;
  const useVirtual = filtered.length > VIRT_THRESHOLD;

  // react-window pasa un solo `data`. Envolvemos items + callback para que
  // TicketRow pueda renderizar y eventualmente borrar. Memoizado para no
  // romper el bail-out de re-render por scroll.
  const listData = useMemo(
    () => ({ items: filtered, onDelete: canDelete ? handleDelete : null }),
    [filtered, canDelete, handleDelete]
  );

  return (
    <Layout>
      <div className="px-4 lg:px-8 py-6 max-w-4xl mx-auto">
        <button onClick={() => navigate(`/evento/${id}`)} className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1">
          ← {event?.name || 'Volver'}
        </button>

        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="min-w-0">
            <h1 className="text-xl font-bold mb-1">📋 Entradas vendidas</h1>
            <p className="text-sm text-gray-400 truncate">{event?.name}</p>
          </div>
          {canExport && (
            <button
              type="button"
              onClick={exportExcel}
              disabled={exporting || tickets.length === 0}
              className="btn-secondary text-xs whitespace-nowrap shrink-0 disabled:opacity-40"
              title="Descargar Excel completo del evento (resumen, entradas, demografía, vendedores)"
            >
              {exporting ? 'Generando...' : '📊 Excel'}
            </button>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="card text-center py-3">
            <p className="text-xl font-bold text-white">{tickets.length}</p>
            <p className="text-[10px] text-gray-500 uppercase">Total</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-xl font-bold text-green-400">{summary.pagadas}</p>
            <p className="text-[10px] text-gray-500 uppercase">Pagadas</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-xl font-bold text-blue-400">{summary.usadas}</p>
            <p className="text-[10px] text-gray-500 uppercase">Usadas</p>
          </div>
          <div className="card text-center py-3">
            <p className="text-xl font-bold text-brand">{fmt(summary.revenue)}</p>
            <p className="text-[10px] text-gray-500 uppercase">Recaudado</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <input
            type="search"
            enterKeyHint="search"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            placeholder="Buscar por nombre, email o QR..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input flex-1"
          />
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="">Todos</option>
            <option value="pagado">Pagado</option>
            <option value="pendiente">Pendiente</option>
            <option value="usado">Usado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>

        {/* Ticket list */}
        {loading ? (
          <div>{Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {search || statusFilter ? 'No se encontraron entradas' : 'No hay entradas vendidas'}
          </div>
        ) : useVirtual ? (
          // Virtualizado: solo monta ~15 filas visibles en el DOM.
          // Cambia de O(n) a O(visible) en costo de render por scroll.
          <>
            <p className="text-[10px] mb-2" style={{ color: '#4B5563' }}>
              Mostrando {filtered.length.toLocaleString('es-AR')} entradas (lista virtualizada para rendimiento)
            </p>
            <VirtualList
              height={LIST_HEIGHT}
              itemCount={filtered.length}
              itemSize={ROW_HEIGHT}
              itemData={listData}
              width="100%"
            >
              {TicketRow}
            </VirtualList>
          </>
        ) : (
          <div className="space-y-2">
            {filtered.map((t, i) => (
              <TicketRow key={t.id} index={i} style={{}} data={listData} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SoldTickets;
