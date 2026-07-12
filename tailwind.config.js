/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,jsx,ts,tsx}',
    './src/renderer/index.html',
  ],
  theme: {
    extend: {
      colors: {
        institution: {
          navy: '#263843',
          teal: '#2f6f7b',
          red: '#a61e32',
          surface: '#ffffff',
          canvas: '#eef1f3',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
