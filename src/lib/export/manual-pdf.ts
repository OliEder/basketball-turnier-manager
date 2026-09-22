import { pdf, Document, Page, Text } from '@react-pdf/renderer'
import { createElement } from 'react'
import manualMarkdown from '@/content/manual.md?raw'
import { tokenizeManualMarkdown, type ManualToken, type CalloutToken } from '@/lib/markdown-tokens'
import { renderManualMarkdownToPdf } from '@/lib/manual-markdown-pdf'
import { pdfBaseStyles } from './pdf-theme'

async function fileToDataUri(url: string): Promise<string> {
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function fetchImagesAsDataUris(filenames: string[]): Promise<Record<string, string>> {
  const base = import.meta.env.BASE_URL
  const entries = await Promise.all(
    filenames.map(async filename => {
      const dataUri = await fileToDataUri(`${base}anleitung/${filename}`)
      return [filename, dataUri] as const
    }),
  )
  return Object.fromEntries(entries)
}

// marked tokenizes a standalone `![alt](src)` line as a `paragraph` token containing a nested
// inline `image` token, never as a top-level `image` token (see markdown-tokens.ts / manual-
// markdown-pdf.ts for the same discovery). This must recurse into a paragraph's `.tokens` array
// (and any inline token's own `.tokens`, e.g. an image inside a link or emphasis) as well as into
// callout bodies, or every screenshot in manual.md -- all standalone image lines -- gets missed.
function collectImageFilenames(tokens: ManualToken[]): string[] {
  const filenames: string[] = []

  function visitInline(inlineTokens: unknown[]): void {
    for (const token of inlineTokens) {
      const t = token as { type: string; href?: string; tokens?: unknown[] }
      if (t.type === 'image' && typeof t.href === 'string') {
        filenames.push(t.href)
      }
      if (Array.isArray(t.tokens)) {
        visitInline(t.tokens)
      }
    }
  }

  for (const token of tokens) {
    if (token.type === 'image') {
      filenames.push((token as { href: string }).href)
    } else if (token.type === 'paragraph') {
      visitInline((token as { tokens: unknown[] }).tokens)
    } else if (token.type === 'callout') {
      filenames.push(...collectImageFilenames((token as CalloutToken).tokens as ManualToken[]))
    } else if (token.type === 'list') {
      const list = token as { items: { tokens: unknown[] }[] }
      for (const item of list.items) {
        visitInline(item.tokens)
      }
    }
  }

  return filenames
}

export async function downloadManualPdf(): Promise<void> {
  const tokens = tokenizeManualMarkdown(manualMarkdown)
  const images = await fetchImagesAsDataUris(collectImageFilenames(tokens))

  // Sections are rendered as a flat, normally-wrapping stream of content (no per-section
  // non-wrapping wrapper): a wrapper View with `wrap: false` cannot be split across pages by
  // react-pdf, and several real manual.md sections contain many full-height screenshots that
  // are taller than a single page -- an unbreakable wrapper around one of those silently
  // overflows/clips content instead of flowing it onto subsequent pages. Occasionally a
  // heading may land near the bottom of a page as a result; that's an acceptable tradeoff for
  // never silently losing content.
  const doc = createElement(Document, { title: 'Nutzeranleitung: Basketball Turnier-Manager' },
    createElement(Page, { size: 'A4', style: pdfBaseStyles.page },
      createElement(Text, { style: pdfBaseStyles.h1 }, 'Nutzeranleitung: Basketball Turnier-Manager'),
      ...renderManualMarkdownToPdf(tokens, images),
    ),
  )

  const blob = await pdf(doc as Parameters<typeof pdf>[0]).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'nutzeranleitung-basketball-turnier-manager.pdf'
  a.click()
  URL.revokeObjectURL(url)
}
