/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  // Envuelve TODOS los `hover:` en @media (hover: hover).
  //
  // Sin esto, en el celular el estado hover se aplica al tocar y QUEDA PEGADO
  // hasta que tocas otra cosa: apretabas una tarjeta, entrabas a la pantalla
  // siguiente, volvias, y la tarjeta seguia pintada como si tuvieras el dedo
  // encima. Es el detalle que mas delata que algo es una web y no una app.
  //
  // Eran 27 reglas en el build. Con esta linea, en pantallas tactiles no se
  // aplica ninguna; en desktop con mouse siguen funcionando igual.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#5C6E5D', // Verde Oliva Mate
          dark:    '#475748',
          light:   '#788C79',
          sand:    '#B59E7D', // Arena / Ocre Mate
        },
        surface: {
          950: '#111312', // Pizarra mate profundo
          900: '#171A19', // Fondo de tarjetas
          800: '#202422', // Superficie secundaria / hover
          700: '#2B312E', // Bordes finos
          600: '#38403C', // Bordes activos
        },
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
