/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#004987', // Azul corporativo principal
          light: '#0066b3',
          dark: '#003b6e',
        },
        secondary: {
          DEFAULT: '#FF4D00', // Naranja corporativo principal
          light: '#ff7033',
          dark: '#cc3e00',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
}
