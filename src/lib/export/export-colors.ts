/**
 * Gemeinsame Farbpalette der Exporte (PDF und HTML-ZIP), Hex-Werte der DSS-Tokens aus
 * @bbv/dss-design-system/tokens/tokens.css (OKLCH, per oklch.ts umgerechnet). Der Drift-Test in
 * pdf-theme.test.ts hält die Werte synchron. Amber ist nie eine Textfarbe (nur Linie/Fläche).
 */
export const exportColors = {
  text: '#0a0705', // --ink-900
  textMuted: '#494e53', // --n-600
  tableHeaderBg: '#f1f4f7', // --n-100
  tableHeaderText: '#0a0705', // --ink-900
  accent: '#f1b200', // --amber-400
  zebra: '#f9fafc', // --n-50
  border: '#e3e7ea', // --n-200
  white: '#ffffff',
} as const
