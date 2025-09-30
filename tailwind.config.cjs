/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        fiq: {
          orange: '#FF8C00',
          dark: '#1A1A1A',
          light: '#F0F0F0',
          teal: '#00BFFF',
          red: '#DC143C'
        }
      },
      fontFamily: {
        heading: ['Montserrat', 'sans-serif'],
        body: ['Open Sans', 'sans-serif']
      }
    },
  },
  plugins: [],
};
