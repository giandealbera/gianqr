// Normalizadores compartidos para que los inputs de texto libre (ciudad,
// nombre, etc) se guarden de forma consistente. Sin estos, "firmat",
// "Firmat" y "FIRMAT" eran 3 ciudades distintas en los reportes
// demograficos.

// Trim + colapso espacios multiples + title-case basico (cada palabra
// con mayuscula inicial). Conserva acentos (no normaliza diacriticos a
// proposito — "Cañuelas" tiene que quedar igual).
function titleCase(s) {
  if (s == null) return s;
  const clean = String(s).trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  return clean
    .split(' ')
    .map(w => w ? w.charAt(0).toLocaleUpperCase('es') + w.slice(1).toLocaleLowerCase('es') : w)
    .join(' ');
}

// Ciudad / localidad. Mismo title-case + tope de largo razonable.
function normalizeCity(s) {
  if (s == null || s === '') return s;
  const t = titleCase(s);
  return t.length > 80 ? t.slice(0, 80) : t;
}

// Nombre / apellido — mismo criterio. Lo dejamos opcional para no romper
// el flow actual: el flow publico ya valida nombre y apellido en otro lado.
function normalizeName(s) {
  if (s == null || s === '') return s;
  return titleCase(s);
}

module.exports = { titleCase, normalizeCity, normalizeName };
