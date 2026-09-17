import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pdf, Document, Page, Text } from '@react-pdf/renderer'
import { createElement } from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fetchImagesAsDataUris } from './manual-pdf'
import { pdfBaseStyles } from './pdf-theme'
import { tokenizeManualMarkdown } from '@/lib/markdown-tokens'
import { renderManualMarkdownToPdf } from '@/lib/manual-markdown-pdf'

describe('fetchImagesAsDataUris', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['fake-image-bytes'], { type: 'image/png' })),
    })
  })

  it('fetches every referenced screenshot filename and returns a filename-to-data-URI map', async () => {
    const result = await fetchImagesAsDataUris(['01-teams-leer.png', '02-team-dialog-leer.png'])
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(Object.keys(result)).toEqual(['01-teams-leer.png', '02-team-dialog-leer.png'])
    expect(result['01-teams-leer.png']).toMatch(/^data:/)
  })
})

describe('manual PDF pagination', () => {
  // Regression test for a bug where each manual section was wrapped in a react-pdf View with
  // `wrap: false`. Several real manual.md sections contain many screenshots and are taller than
  // one page; a non-wrapping View taller than the page cannot be split by react-pdf and silently
  // overflows/clips instead. react-pdf's layout engine surfaces this itself via a console.warn
  // ("Node of type VIEW can't wrap between pages and it's bigger than available page height")
  // during actual PDF rendering (not just element-tree construction), so this test renders a
  // full document built from the real manual.md content and asserts that warning is never
  // emitted. Confirmed empirically: re-wrapping each section in `wrap: false` here reproduces
  // the warning even WITHOUT real images (a strict lower bound on section height).
  it('renders the full real manual.md without react-pdf emitting a "cannot wrap" overflow warning', async () => {
    const manualMarkdown = fs.readFileSync(
      path.resolve(__dirname, '../../content/manual.md'),
      'utf-8',
    )
    const tokens = tokenizeManualMarkdown(manualMarkdown)

    const warnings: string[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => {
      warnings.push(args.join(' '))
    }

    try {
      const doc = createElement(Document, { title: 'Nutzeranleitung: Basketball Turnier-Manager' },
        createElement(Page, { size: 'A4', style: pdfBaseStyles.page },
          createElement(Text, { style: pdfBaseStyles.h1 }, 'Nutzeranleitung: Basketball Turnier-Manager'),
          ...renderManualMarkdownToPdf(tokens, {}),
        ),
      )
      await pdf(doc as Parameters<typeof pdf>[0]).toBlob()
    } finally {
      console.warn = originalWarn
    }

    const overflowWarnings = warnings.filter(w => w.includes("can't wrap between pages"))
    expect(overflowWarnings).toEqual([])
  }, 30000)
})
