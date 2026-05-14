/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#2563EB',
          dark:    '#1D4ED8',
          light:   '#3B82F6',
        },
      },
    },
  },
  plugins: [],
};
