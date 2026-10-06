import { Font } from '@react-pdf/renderer'
import sora600 from '@fontsource/sora/files/sora-latin-600-normal.woff?url'
import sora700 from '@fontsource/sora/files/sora-latin-700-normal.woff?url'
import manrope400 from '@fontsource/manrope/files/manrope-latin-400-normal.woff?url'
import manrope600 from '@fontsource/manrope/files/manrope-latin-600-normal.woff?url'
import manrope700 from '@fontsource/manrope/files/manrope-latin-700-normal.woff?url'

/**
 * DSS-Schriften für die PDF-Exporte. react-pdf liest TTF und WOFF, aber weder WOFF2 noch
 * Variable-Fonts, deshalb die statischen WOFF-Schnitte aus @fontsource (Latin deckt Deutsch ab).
 * Es gibt bewusst keine Italic-Schnitte: Weder Sora noch Manrope haben welche.
 */
export const PDF_FONT_FILES = {
  Sora: [
    { weight: 600, src: sora600 },
    { weight: 700, src: sora700 },
  ],
  Manrope: [
    { weight: 400, src: manrope400 },
    { weight: 600, src: manrope600 },
    { weight: 700, src: manrope700 },
  ],
} as const

let registered = false

/**
 * Registriert Sora und Manrope bei react-pdf (einmalig, idempotent). `transformUrl` erlaubt Tests,
 * die Vite-URL auf eine ladbare Quelle (Data-URI) abzubilden; im Browser genügt der Standard.
 */
export function registerPdfFonts(transformUrl: (url: string) => string = url => url): void {
  if (registered) return
  for (const [family, files] of Object.entries(PDF_FONT_FILES)) {
    Font.register({
      family,
      fonts: files.map(file => ({ src: transformUrl(file.src), fontWeight: file.weight })),
    })
  }
  registered = true
}
