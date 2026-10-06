import { Text, View } from '@react-pdf/renderer'
import { createElement } from 'react'
import { pdfBaseStyles, pdfColors } from './pdf-theme'

/**
 * Haupttitel einer PDF-Seite mit schmaler Amber-Linie darunter. Die Linie ist ein eigenes View,
 * weil Rahmen an Text-Knoten in react-pdf nicht verlässlich gezeichnet werden.
 */
export function PageTitle(title: string) {
  return createElement(View, {},
    createElement(Text, { style: pdfBaseStyles.h1 }, title),
    createElement(View, { style: { height: 2, backgroundColor: pdfColors.accent, marginBottom: 10 } }),
  )
}
