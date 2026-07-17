/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{html,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui'],
        display: ['"Fraunces"', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace'],
      },
      colors: {
        cosmic: {
          bg: '#0b0d12',
          panel: '#12151d',
          card: '#161a24',
          border: '#232838',
          muted: '#8b93a7',
          text: '#e6e9f2',
          accent: '#7c5cff',
          accent2: '#22d3ee',
          success: '#22c55e',
          warn: '#f59e0b',
          danger: '#ef4444',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(124,92,255,0.35), 0 8px 30px rgba(124,92,255,0.15)',
        card: '0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 30px rgba(0,0,0,0.35)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(124,92,255,0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(124,92,255,0)' },
        },
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'fade-up': 'fadeUp .35s ease-out both',
      },
    },
  },
  plugins: [],
};
