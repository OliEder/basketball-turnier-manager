import type { Config } from 'tailwindcss'
import dssPreset from '@bbv/dss-design-system/tailwind'

/**
 * DSS-Preset plus semantische Klassen auf den `--dss-*`-Aliasen (ADR-11/13).
 * Hinweis: Die Preset-Farben sind OKLCH-Strings — Alpha-Modifier wie `bg-ink-900/50` funktionieren nicht.
 */
export default {
  presets: [dssPreset],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantische Klassen auf den DSS-Aliasen (dark-sicher): text-fg, bg-surface, border-line …
        fg: 'var(--dss-fg)',
        'fg-soft': 'var(--dss-fg-soft)',
        mute: 'var(--dss-mute)',
        line: 'var(--dss-line)',
        'line-strong': 'var(--dss-line-strong)',
        surface: 'var(--dss-surface)',
        'surface-2': 'var(--dss-surface-2)',
        hover: 'var(--dss-hover-bg)',
        page: 'var(--page-bg)',
        err: 'var(--err-button)',
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
