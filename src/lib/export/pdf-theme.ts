import { StyleSheet } from '@react-pdf/renderer'

import { exportColors } from './export-colors'

export const pdfColors = exportColors

export const pdfBaseStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  h1: { fontSize: 20, fontWeight: 'bold', color: pdfColors.text, textTransform: 'uppercase', marginBottom: 8 },
  h2: { fontSize: 14, fontWeight: 'bold', color: pdfColors.text, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  h3: { fontSize: 11, fontWeight: 'bold', color: pdfColors.text, marginTop: 10, marginBottom: 4 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: pdfColors.tableHeaderBg },
  tableHeaderCell: { color: pdfColors.tableHeaderText, fontSize: 9, fontWeight: 600, padding: 4 },
  tableRow: { flexDirection: 'row', borderBottom: `1px solid ${pdfColors.border}` },
  tableRowEven: { backgroundColor: pdfColors.zebra },
  cell: { fontSize: 9, color: pdfColors.text, padding: 4 },
})
