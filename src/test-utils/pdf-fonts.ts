import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerPdfFonts } from '@/lib/export/pdf-fonts'

/** Vite liefert `?url`-Importe in Vitest als Root-relative Pfade (`/node_modules/...`). */
function toDataUri(url: string): string {
  const relative = url.split('?')[0].replace(/^\/@fs/, '')
  const file = relative.startsWith(process.cwd()) ? relative : join(process.cwd(), relative)
  return `data:font/woff;base64,${readFileSync(file).toString('base64')}`
}

export function registerPdfFontsForTests(): void {
  registerPdfFonts(toDataUri)
}
