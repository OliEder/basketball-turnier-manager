import type { Config } from 'tailwindcss'
import dssPreset from '@bbv/dss-design-system/tailwind'

/**
 * DSS-Preset (ink-*, amber-*, sky-*, neutral-*) plus eine ÜBERGANGSSCHICHT: die Alt-Namen
 * (brand.*, muted, card, border, secondary, tint …) zeigen auf DSS-Variablen, damit Seiten, die noch
 * nicht migriert sind, weiterlaufen. Die Schicht wird in Teil 3 der DSS-Migration gelöscht, sobald
 * keine Datei mehr `brand-*`, `text-muted-foreground`, `border-border` usw. verwendet.
 * Hinweis: Die Preset-Farben sind OKLCH-Strings — Alpha-Modifier wie `bg-ink-900/50` funktionieren nicht.
 */
export default {
  presets: [dssPreset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--ink-800)',
          'primary-dark': 'var(--ink-900)',
          'primary-light': 'var(--ink-700)',
          accent: 'var(--amber-400)',
          'accent-text': 'var(--dss-accent-text)',
        },
        background: 'var(--page-bg)',
        foreground: 'var(--dss-fg)',
        muted: {
          DEFAULT: 'var(--dss-surface-2)',
          foreground: 'var(--dss-mute)',
        },
        card: 'var(--dss-surface)',
        border: 'var(--dss-line)',
        'border-ui': 'var(--n-500)',
        secondary: {
          DEFAULT: 'var(--dss-surface-2)',
          hover: 'var(--dss-line)',
          border: 'var(--dss-line-strong)',
        },
        destructive: {
          DEFAULT: 'var(--err-button)',
          foreground: '#ffffff',
        },
        tint: 'var(--dss-hover-bg)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        sans: ['var(--font-body)'],
        caption: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
    },
  },
  plugins: [],
} satisfies Config
