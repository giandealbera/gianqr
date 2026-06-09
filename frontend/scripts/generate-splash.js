// Genera splash screens PNG solidos del color de marca para iOS PWA.
// iOS muestra estos al abrir la app desde el home screen (apple-touch-
// startup-image en index.html). Sin estos, se ve un flash blanco hasta que
// el JS hidrata.
//
// Mantengo los splash SOLIDOS (sin logo ni texto) a proposito: el flash es
// de fracciones de segundo, no vale la pena un asset pesado. Apenas
// "pinten" del mismo color de fondo de la app, la transicion deja de
// notarse. Si en el futuro queremos logo, se puede sumar acá generando un
// canvas, pero el costo es 5-10x el tamaño.
//
// Uso: npm run gen:splash

const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// Color de fondo de la app (mismo que index.html y manifest background_color).
const BG = { r: 0x07, g: 0x09, b: 0x0E, a: 0xFF };

// Resoluciones portrait de iPhones modernos. Cada entrada tambien tiene
// un selector media query para que iOS sepa cual servir.
// device-width / device-height son en CSS points; los multiplico por
// device-pixel-ratio para sacar la resolucion real del PNG.
const SIZES = [
  // iPhone 14 Pro Max, 15 Pro Max
  { w: 1290, h: 2796, label: '430x932@3x' },
  // iPhone 14 Pro, 15 Pro
  { w: 1179, h: 2556, label: '393x852@3x' },
  // iPhone 12/13/14 Plus, XS Max, 11 Pro Max
  { w: 1284, h: 2778, label: '428x926@3x' },
  // iPhone 12/13/14/15
  { w: 1170, h: 2532, label: '390x844@3x' },
  // iPhone X, XS, 11 Pro, 12 mini, 13 mini
  { w: 1125, h: 2436, label: '375x812@3x' },
  // iPhone XR, 11
  { w: 828, h: 1792, label: '414x896@2x' },
  // iPhone 8 Plus
  { w: 1242, h: 2208, label: '414x736@3x' },
  // iPhone 8, SE2/3
  { w: 750, h: 1334, label: '375x667@2x' },
];

const OUT_DIR = path.resolve(__dirname, '..', 'public', 'splash');
fs.mkdirSync(OUT_DIR, { recursive: true });

for (const s of SIZES) {
  const png = new PNG({ width: s.w, height: s.h });
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const idx = (s.w * y + x) << 2;
      png.data[idx]     = BG.r;
      png.data[idx + 1] = BG.g;
      png.data[idx + 2] = BG.b;
      png.data[idx + 3] = BG.a;
    }
  }
  const file = path.join(OUT_DIR, `splash-${s.w}x${s.h}.png`);
  png.pack().pipe(fs.createWriteStream(file).on('finish', () => {
    console.log(`✓ ${path.relative(process.cwd(), file)}`);
  }));
}
