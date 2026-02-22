/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./host/index.html",
    "./dashboard/index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter Tight', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
        body: ['Inter Tight', 'sans-serif'],
        data: ['Geist Mono', 'monospace'],
        mono: ['Geist Mono', 'monospace'],
        // Dashboard cinematic fonts
        'dash-display': ['Instrument Serif', 'Georgia', 'serif'],
        'dash-body': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'dash-mono': ['JetBrains Mono', 'SF Mono', 'monospace'],
      },
      colors: {
        // Host UI colors (CSS variable based for dark/light mode)
        base: 'rgb(var(--bg-base) / <alpha-value>)',
        surface: 'rgb(var(--bg-surface) / <alpha-value>)',
        elevated: 'rgb(var(--bg-elevated) / <alpha-value>)',
        hover: 'rgb(var(--bg-hover) / <alpha-value>)',
        primary: 'rgb(var(--text-primary) / <alpha-value>)',
        secondary: 'rgb(var(--text-secondary) / <alpha-value>)',
        tertiary: 'rgb(var(--text-tertiary) / <alpha-value>)',
        muted: 'rgb(var(--text-muted) / <alpha-value>)',
        'accent-green': 'rgb(var(--accent-green) / <alpha-value>)',
        'accent-blue': 'rgb(var(--accent-blue) / <alpha-value>)',
        'accent-yellow': 'rgb(var(--accent-yellow) / <alpha-value>)',
        'accent-orange': 'rgb(var(--accent-orange) / <alpha-value>)',
        'accent-red': 'rgb(var(--accent-red) / <alpha-value>)',
        'accent-purple': 'rgb(var(--accent-purple) / <alpha-value>)',
        'accent-brown': 'rgb(var(--accent-brown) / <alpha-value>)',
        'gold': 'rgb(var(--gold) / <alpha-value>)',
        'ice-blue': 'rgb(var(--ice-blue) / <alpha-value>)',
        'status-good': 'rgb(var(--status-good) / <alpha-value>)',
        'accent-primary': 'rgb(var(--accent-primary) / <alpha-value>)',
        // Dashboard cinematic variable theme colors
        'dash-base': 'rgb(var(--dash-base) / <alpha-value>)',
        'dash-surface': 'rgb(var(--dash-surface) / <alpha-value>)',
        'dash-elevated': 'rgb(var(--dash-elevated) / <alpha-value>)',
        'dash-border': 'var(--dash-border-color)',
        'dash-cream': 'rgb(var(--dash-cream) / <alpha-value>)',
        'dash-secondary': 'rgb(var(--dash-secondary) / <alpha-value>)',
        'dash-tertiary': 'rgb(var(--dash-tertiary) / <alpha-value>)',
        'dash-gold': 'rgb(var(--dash-gold) / <alpha-value>)',
        'dash-gold-muted': 'rgb(var(--dash-gold-muted) / <alpha-value>)',
        'dash-success': 'rgb(var(--dash-success) / <alpha-value>)',
        'dash-warning': 'rgb(var(--dash-warning) / <alpha-value>)',
        'dash-danger': 'rgb(var(--dash-danger) / <alpha-value>)',
        'dash-neutral': 'rgb(var(--dash-neutral) / <alpha-value>)',
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'floating': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'glass': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'gold-glow': '0 0 20px rgba(201, 169, 98, 0.2)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(52, 199, 89, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(52, 199, 89, 0.5)' },
        },
        'pulse-gold': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(201, 169, 98, 0.4)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 0 4px rgba(201, 169, 98, 0)' },
        }
      }
    },
    borderColor: ({ theme }) => ({
      ...theme('colors'),
      DEFAULT: 'transparent',
    }),
  },
  plugins: [],
}
