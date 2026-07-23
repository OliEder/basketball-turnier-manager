import type { Config } from 'tailwindcss'

/**
 * Farb-Mapping auf das FBNM-Design-System (CSS Custom Properties aus
 * src/styles/fbnm/tokens.css — Quelle: 00-FBNM-design-system).
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--fbnm-color-primary)',        // #004174
          'primary-dark': 'var(--fbnm-color-primary-dark)',  // #002751
          'primary-light': 'var(--fbnm-color-primary-light)', // #1a4b76
          accent: 'var(--fbnm-color-accent)',          // #009fe3 (nur dekorativ)
          'accent-text': 'var(--fbnm-color-accent-text)', // #005a87 (AAA auf Weiß)
        },
        background: 'var(--fbnm-color-background)',
        foreground: 'var(--fbnm-color-text)',
        muted: {
          DEFAULT: 'var(--fbnm-color-surface-muted)',
          foreground: 'var(--fbnm-color-text-muted)',
        },
        card: 'var(--fbnm-color-surface)',
        border: 'var(--fbnm-color-border)',
        'border-ui': 'var(--fbnm-color-border-ui)',
        secondary: {
          DEFAULT: 'var(--fbnm-color-secondary)',
          hover: 'var(--fbnm-color-secondary-hover)',
          border: 'var(--fbnm-color-secondary-border)',
        },
        destructive: {
          DEFAULT: '#b3261e',
          foreground: '#ffffff',
        },
        tint: 'var(--fbnm-color-surface-tint)',
      },
      fontFamily: {
        display: ['INSOLENT', 'Arial Black', 'sans-serif'],
        sans: ['ALLER', 'Arial', 'sans-serif'],
        caption: ['Montserrat', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        sm: 'var(--fbnm-radius-sm)',
        md: 'var(--fbnm-radius-md)',
        lg: 'var(--fbnm-radius-lg)',
      },
    },
  },
  plugins: [],
} satisfies Config
