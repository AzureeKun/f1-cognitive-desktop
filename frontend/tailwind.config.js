/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mercedes AMG Petronas F1 Team Colors
        'merc-black': '#000000',
        'merc-silver': '#C8CCCE',
        'merc-gray': '#565F64',
        'merc-teal': '#00A19B',
        'merc-white': '#FFFFFF',
        // Extended palette for dashboard
        'dash-bg': '#0a0a0f',
        'dash-card': '#12131a',
        'dash-border': '#1e2028',
        'dash-text': '#e8e8e8',
        'dash-muted': '#8a8a9a',
        'focus-high': '#00A19B',
        'focus-medium': '#f5a623',
        'focus-low': '#e74c3c',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-teal': '0 0 20px rgba(0, 161, 155, 0.3)',
        'glow-red': '0 0 20px rgba(231, 76, 60, 0.3)',
      }
    },
  },
  plugins: [],
}
