// Porcentajes y anchos de barra a prueba de datos raros.
//
// Motivo: las barras de progreso se dibujaban con `width: ${pct}%` sin ningun
// tope. Cuando la cuenta daba mas de 100 —por ejemplo el check-in del evento,
// que dividia escaneadas por NO-escaneadas y con 9 de 10 daba 900%— la barra
// se dibujaba nueve veces mas ancha que su tarjeta y se iba de la pantalla.

/**
 * Porcentaje entero 0-100. Devuelve 0 si el total es cero o invalido, y
 * nunca pasa de 100 aunque la parte sea mayor que el total.
 */
export function porcentaje(parte, total) {
  const p = Number(parte);
  const t = Number(total);
  if (!isFinite(p) || !isFinite(t) || t <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((p / t) * 100)));
}

/**
 * Ancho CSS para una barra de progreso, topeado a 100%.
 *
 * @param {number} pct    porcentaje ya calculado
 * @param {number} minimo piso opcional, para que se vea un hilito cuando hay
 *                        algo pero es muy poco (no aplica si pct es 0)
 */
export function anchoBarra(pct, minimo = 0) {
  const v = Number(pct);
  if (!isFinite(v) || v <= 0) return `${Math.max(0, minimo)}%`;
  return `${Math.min(100, Math.max(minimo, v))}%`;
}
