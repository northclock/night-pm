/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'night-bg': '#1e1e2e',
        'night-sidebar': '#181825',
        'night-surface': '#313244',
        'night-border': '#45475a',
        'night-text': '#cdd6f4',
        'night-subtext': '#a6adc8',
        'night-accent': '#89b4fa',
        'night-accent2': '#cba6f7',
        'night-green': '#a6e3a1',
        'night-red': '#f38ba8',
        'night-yellow': '#f9e2af',
        'night-peach': '#fab387',
      },
    },
  },
  plugins: [],
};
