/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Theme-aware surface tokens. Values come from CSS variables set per
        // `.theme-*` class on <html>. Keeping the `ink-*` scale means existing
        // components continue to work with zero churn.
        ink: {
          950: 'rgb(var(--surface-0) / <alpha-value>)',
          900: 'rgb(var(--surface-1) / <alpha-value>)',
          800: 'rgb(var(--surface-2) / <alpha-value>)',
          700: 'rgb(var(--surface-3) / <alpha-value>)',
          600: 'rgb(var(--surface-4) / <alpha-value>)'
        },
        // Theme-aware accent tokens (legacy names).
        cyan: {
          glow: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)'
        },
        claude: {
          amber: 'rgb(var(--accent-2) / <alpha-value>)',
          peach: 'rgb(var(--accent-2-soft) / <alpha-value>)',
          coral: 'rgb(var(--coral) / <alpha-value>)'
        },
        // Short aliases used by newer components.
        accent:          'rgb(var(--accent) / <alpha-value>)',
        'accent-soft':   'rgb(var(--accent-soft) / <alpha-value>)',
        'accent-2':      'rgb(var(--accent-2) / <alpha-value>)',
        'accent-2-soft': 'rgb(var(--accent-2-soft) / <alpha-value>)',
        coral:           'rgb(var(--coral) / <alpha-value>)',
        primary:         'rgb(var(--text-primary) / <alpha-value>)',
        muted:           'rgb(var(--text-muted) / <alpha-value>)'
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace']
      },
      boxShadow: {
        'glow-cyan':   '0 0 24px 2px rgb(var(--accent) / 0.35)',
        'glow-amber':  '0 0 24px 2px rgb(var(--accent-2) / 0.35)',
        'glow-accent': '0 0 24px 2px rgb(var(--accent) / 0.35)'
      },
      keyframes: {
        'pulse-ring': {
          '0%':   { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(1.4)', opacity: '0'   }
        },
        'sheen': {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%':     { backgroundPosition: '100% 50%' }
        }
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.2,0.6,0.4,1) infinite',
        'sheen':      'sheen 6s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
