/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1a1a1a',
        'ink-light': '#4a4a4a',
        'ink-muted': '#7a7a7a',
        paper: '#ffffff',
        'paper-warm': '#faf9f7',
        'paper-alt': '#f5f4f2',
        rule: '#e5e3e0',
        'rule-dark': '#c8c5c0',
        accent: {
          blue: '#2e5e8e',
          red: '#c1352d',
          green: '#2e7d4f',
          amber: '#b8860b',
          slate: '#64748b',
        },
        chart: {
          1: '#1a1a1a',
          2: '#64748b',
          3: '#94a3b8',
          4: '#cbd5e1',
          5: '#2e5e8e',
          6: '#c1352d',
          7: '#2e7d4f',
          8: '#b8860b',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: ['Consolas', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
}
