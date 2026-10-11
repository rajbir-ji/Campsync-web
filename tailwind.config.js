/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // <-- This is the magic line that forces Tailwind to listen to the button
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}