import { StyleSheet } from '@react-pdf/renderer'

export const pdfColors = {
  brandBlue: '#004174',
  textDark: '#002751',
  zebra: '#f0f7fc',
  white: '#fff',
  border: '#e2e8f0',
}

export const pdfBaseStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  h1: { fontSize: 20, fontWeight: 'bold', color: pdfColors.brandBlue, textTransform: 'uppercase', marginBottom: 8 },
  h2: { fontSize: 14, fontWeight: 'bold', color: pdfColors.brandBlue, textTransform: 'uppercase', marginTop: 16, marginBottom: 6 },
  h3: { fontSize: 11, fontWeight: 'bold', color: pdfColors.brandBlue, marginTop: 10, marginBottom: 4 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: pdfColors.brandBlue },
  tableHeaderCell: { color: pdfColors.white, fontSize: 9, fontWeight: 600, padding: 4 },
  tableRow: { flexDirection: 'row', borderBottom: `1px solid ${pdfColors.border}` },
  tableRowEven: { backgroundColor: pdfColors.zebra },
  cell: { fontSize: 9, color: pdfColors.textDark, padding: 4 },
})
