/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#C9974D',
          dark:    '#A87B35',
          light:   '#E0B870',
        },
        surface: {
          950: '#07090E',
          900: '#0D1117',
          800: '#161B24',
          700: '#1E2530',
          600: '#263040',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
