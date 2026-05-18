/**
 * Export array de objetos a CSV y descarga el archivo.
 *
 * Uso:
 *   exportCsv({
 *     filename: 'reporte-ventas',
 *     rows: [{ name: 'Juan', monto: 1000 }, ...],
 *     columns: [
 *       { key: 'name',  label: 'Nombre' },
 *       { key: 'monto', label: 'Monto $', format: (v) => v.toFixed(2) },
 *     ],
 *   });
 */
export function exportCsv({ filename = 'export', rows = [], columns = [] }) {
  if (!rows.length || !columns.length) return;

  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    // Si tiene coma, comillas o saltos de linea, envolver en comillas y duplicar las internas
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  // BOM UTF-8 para que Excel lo abra bien (acentos)
  const BOM = '﻿';
  const header = columns.map(c => escape(c.label || c.key)).join(',');
  const body = rows.map(row =>
    columns.map(c => {
      const v = c.format ? c.format(row[c.key], row) : row[c.key];
      return escape(v);
    }).join(',')
  ).join('\n');

  const csv = BOM + header + '\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
