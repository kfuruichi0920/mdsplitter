/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#3b82f6',
          surface: '#0f172a',
        },
        theme: {
          background: 'rgb(var(--theme-background) / <alpha-value>)',
          foreground: 'rgb(var(--theme-foreground) / <alpha-value>)',
          border: 'rgb(var(--theme-border) / <alpha-value>)',
          primary: 'rgb(var(--theme-primary) / <alpha-value>)',
          secondary: 'rgb(var(--theme-secondary) / <alpha-value>)',
          card: 'rgb(var(--theme-card-background) / <alpha-value>)',
          'card-border': 'rgb(var(--theme-card-border) / <alpha-value>)',
          'connector-active': 'rgb(var(--theme-connector-active) / <alpha-value>)',
          'connector-inactive': 'rgb(var(--theme-connector-inactive) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};
