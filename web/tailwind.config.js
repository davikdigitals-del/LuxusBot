/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0E1116',
          900: '#12151C',
          800: '#1B1F29',
          700: '#262B38',
          600: '#333A4A',
        },
        stone: {
          50: '#FAF9F7',
          100: '#F4F2EE',
          200: '#E8E4DC',
          300: '#D8D2C6',
        },
        brass: {
          DEFAULT: '#B8923F',
          light: '#D4B168',
          dark: '#8F6F2E',
        },
        signal: {
          green: '#3F7A5C',
          red: '#B0483F',
          amber: '#B8923F',
        },
      },
      fontFamily: {
        // System font stacks - no external font fetch, works fully offline.
        // "display" leans on each OS's serif for the Luxus wordmark and section
        // titles; "sans" is the default UI stack everywhere else.
        display: ['Charter', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Inter', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        md: '8px',
        lg: '10px',
      },
    },
  },
  plugins: [],
};
