/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#7C3AED',
          dark:    '#5B21B6',
          light:   '#A78BFA',
        },
      },
    },
  },
  plugins: [],
};
