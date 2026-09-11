import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderManualPrintHtml, openManualPrintWindow } from './manual-print-export'

function buildContainer(): HTMLElement {
  const container = document.createElement('div')

  const button = document.createElement('button')
  button.textContent = 'Als PDF herunterladen'
  container.appendChild(button)

  const heading = document.createElement('h1')
  heading.textContent = 'Nutzeranleitung: Basketball Turnier-Manager'
  container.appendChild(heading)

  const toc = document.createElement('nav')
  toc.setAttribute('aria-label', 'Inhalt')
  const tocLink = document.createElement('a')
  tocLink.setAttribute('href', '#ueberblick')
  tocLink.textContent = '1. Überblick'
  toc.appendChild(tocLink)
  container.appendChild(toc)

  const img = document.createElement('img')
  img.setAttribute('src', '/anleitung/01-teams-leer.png')
  img.setAttribute('alt', 'Leere Teamübersicht')
  container.appendChild(img)

  return container
}

describe('renderManualPrintHtml', () => {
  it('replaces image sources with their matching data URIs and strips buttons', () => {
    const container = buildContainer()
    const images = { '01-teams-leer.png': 'data:image/png;base64,AAAA' }

    const html = renderManualPrintHtml(container, images)

    expect(html).toContain('data:image/png;base64,AAAA')
    expect(html).not.toContain('/anleitung/01-teams-leer.png')
    expect(html).not.toContain('<button>')
    expect(html).toContain('Nutzeranleitung: Basketball Turnier-Manager')
  })

  it('strips the table of contents navigation from the print output', () => {
    const container = buildContainer()
    const images = { '01-teams-leer.png': 'data:image/png;base64,AAAA' }

    const html = renderManualPrintHtml(container, images)

    expect(html).not.toContain('aria-label="Inhalt"')
    expect(html).not.toContain('#ueberblick')
  })
})

describe('openManualPrintWindow', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    const manualContent = document.createElement('div')
    manualContent.id = 'manual-content'
    const img = document.createElement('img')
    img.setAttribute('src', '/anleitung/01-teams-leer.png')
    manualContent.appendChild(img)
    document.body.appendChild(manualContent)

    global.fetch = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['fake-image-bytes'], { type: 'image/png' })),
    })
  })

  it('loads screenshots, opens a printable blob URL and triggers print', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null)

    await openManualPrintWindow()

    expect(fetch).toHaveBeenCalled()
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(openSpy).toHaveBeenCalledWith('blob:mock-url', '_blank')
  })
})
