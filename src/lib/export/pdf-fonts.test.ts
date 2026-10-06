import { describe, it, expect } from 'vitest'
import { Font, pdf, Document, Page, Text } from '@react-pdf/renderer'
import { createElement } from 'react'
import { PDF_FONT_FILES, registerPdfFonts } from './pdf-fonts'
import { registerPdfFontsForTests } from '@/test-utils/pdf-fonts'

describe('pdf-fonts', () => {
  it('describes Sora 600/700 and Manrope 400/600/700 as WOFF files', () => {
    expect(PDF_FONT_FILES.Sora.map(f => f.weight)).toEqual([600, 700])
    expect(PDF_FONT_FILES.Manrope.map(f => f.weight)).toEqual([400, 600, 700])
    for (const file of [...PDF_FONT_FILES.Sora, ...PDF_FONT_FILES.Manrope]) {
      expect(file.src).toMatch(/\.woff(\?.*)?$/)
    }
  })

  it('registers both families, and registering twice is harmless', () => {
    registerPdfFontsForTests()
    registerPdfFonts() // zweiter Aufruf: kein erneutes Registrieren
    const families = Font.getRegisteredFontFamilies()
    expect(families).toContain('Sora')
    expect(families).toContain('Manrope')
  })

  it('renders a real PDF using the registered fonts at every used weight', async () => {
    registerPdfFontsForTests()
    const doc = createElement(Document, {},
      createElement(Page, { size: 'A4' },
        createElement(Text, { style: { fontFamily: 'Sora', fontWeight: 700 } }, 'Überschrift'),
        createElement(Text, { style: { fontFamily: 'Sora', fontWeight: 600 } }, 'Unterüberschrift'),
        createElement(Text, { style: { fontFamily: 'Manrope', fontWeight: 400 } }, 'Fließtext äöüß'),
        createElement(Text, { style: { fontFamily: 'Manrope', fontWeight: 600 } }, 'Tabellenkopf'),
        createElement(Text, { style: { fontFamily: 'Manrope', fontWeight: 700 } }, 'Fett'),
      ),
    )
    const blob = await pdf(doc as Parameters<typeof pdf>[0]).toBlob()
    expect(blob.size).toBeGreaterThan(1000)
  })
})
