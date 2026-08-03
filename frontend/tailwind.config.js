/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
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
