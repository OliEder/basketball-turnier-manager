import { StyleSheet } from '@react-pdf/renderer'
import { exportColors } from './export-colors'

export const pdfColors = exportColors

/** Registrierte Familien (siehe pdf-fonts.ts). */
export const pdfFonts = { heading: 'Sora', body: 'Manrope' } as const

export const pdfBaseStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: pdfFonts.body, fontWeight: 400, color: pdfColors.text },
  h1: { fontFamily: pdfFonts.heading, fontSize: 20, fontWeight: 700, color: pdfColors.text, marginBottom: 4 },
  h2: { fontFamily: pdfFonts.heading, fontSize: 14, fontWeight: 700, color: pdfColors.text, marginTop: 16, marginBottom: 6 },
  h3: { fontFamily: pdfFonts.heading, fontSize: 11, fontWeight: 600, color: pdfColors.text, marginTop: 10, marginBottom: 4 },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: pdfColors.tableHeaderBg,
    borderBottom: `2px solid ${pdfColors.accent}`,
  },
  tableHeaderCell: {
    fontFamily: pdfFonts.body,
    color: pdfColors.tableHeaderText,
    fontSize: 9,
    fontWeight: 600,
    padding: 4,
  },
  tableRow: { flexDirection: 'row', borderBottom: `1px solid ${pdfColors.border}` },
  tableRowEven: { backgroundColor: pdfColors.zebra },
  cell: { fontFamily: pdfFonts.body, fontSize: 9, fontWeight: 400, color: pdfColors.text, padding: 4 },
})
