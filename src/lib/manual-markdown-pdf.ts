import { Text, View, Image } from '@react-pdf/renderer'
import { createElement, type ReactElement, type ReactNode } from 'react'
import type { Tokens } from 'marked'
import type { ManualToken, CalloutToken } from './markdown-tokens'
import { pdfBaseStyles, pdfColors } from './export/pdf-theme'

function renderImageToken(image: Tokens.Image, images: Record<string, string>, key: number | string): ReactElement {
  const src = images[image.href]
  return createElement(
    View,
    { key, style: { marginBottom: 8 } },
    src ? createElement(Image, { src, style: { maxWidth: '100%' } }) : null,
    createElement(Text, { style: { fontSize: 8, color: pdfColors.textDark, marginTop: 2 } }, image.text),
  )
}

function renderInlineText(tokens: Tokens.Generic[], images: Record<string, string>): ReactNode[] {
  return tokens.map((token, i) => {
    switch (token.type) {
      case 'strong':
        return createElement(Text, { key: i, style: { fontWeight: 'bold' } }, ...renderInlineText((token as Tokens.Strong).tokens, images))
      case 'em':
        return createElement(Text, { key: i, style: { fontStyle: 'italic' } }, ...renderInlineText((token as Tokens.Em).tokens, images))
      case 'link':
        return createElement(Text, { key: i, style: { textDecoration: 'underline' } }, ...renderInlineText((token as Tokens.Link).tokens, images))
      case 'image':
        // marked tokenizes a standalone `![alt](src)` line as a paragraph containing a
        // nested inline `image` token rather than a top-level `image` token (see
        // manual-markdown-jsx.tsx for the same discovery). Render it the same way we'd
        // render a top-level image token so it still gets its data-URI + caption box.
        return renderImageToken(token as Tokens.Image, images, i)
      case 'text':
        return (token as Tokens.Text).text ?? ''
      default:
        return createElement(Text, { key: i }, (token as Tokens.Text).text ?? '')
    }
  })
}

export function renderManualMarkdownToPdf(tokens: ManualToken[], images: Record<string, string>): ReactElement[] {
  const elements: ReactElement[] = []
  tokens.forEach((token, i) => {
    switch (token.type) {
      case 'heading': {
        const heading = token as Tokens.Heading
        const style = heading.depth === 2 ? pdfBaseStyles.h2 : pdfBaseStyles.h3
        elements.push(createElement(Text, { key: i, style }, heading.text))
        break
      }
      case 'paragraph': {
        const paragraph = token as Tokens.Paragraph
        // A paragraph consisting solely of an inline image (the common `![alt](src)` case)
        // should render as an image block, not be wrapped in a Text element.
        if (paragraph.tokens.length === 1 && paragraph.tokens[0].type === 'image') {
          elements.push(renderImageToken(paragraph.tokens[0] as Tokens.Image, images, i))
        } else {
          elements.push(createElement(Text, { key: i, style: pdfBaseStyles.cell }, ...renderInlineText(paragraph.tokens, images)))
        }
        break
      }
      case 'list': {
        const list = token as Tokens.List
        elements.push(createElement(View, { key: i, style: { marginBottom: 6 } },
          ...list.items.map((item, itemIndex) => {
            const prefix = list.ordered ? `${(list.start || 1) + itemIndex}. ` : '• '
            const inline = renderInlineText(item.tokens, images)
            // Merge the prefix into the first text node (rather than passing it as a
            // separate child) so serialized/rendered output reads "• first" contiguously
            // instead of splitting across two adjacent string children.
            const merged = typeof inline[0] === 'string' ? [prefix + inline[0], ...inline.slice(1)] : [prefix, ...inline]
            return createElement(Text, { key: itemIndex, style: pdfBaseStyles.cell }, ...merged)
          }),
        ))
        break
      }
      case 'image':
        elements.push(renderImageToken(token as Tokens.Image, images, i))
        break
      case 'callout': {
        const callout = token as CalloutToken
        elements.push(createElement(View, {
          key: i,
          style: { backgroundColor: pdfColors.zebra, borderRadius: 4, padding: 8, marginBottom: 8 },
        },
          createElement(Text, { style: { fontWeight: 'bold', color: pdfColors.brandBlue, marginBottom: 4, fontSize: 9 } }, callout.title),
          ...renderManualMarkdownToPdf(callout.tokens as ManualToken[], images),
        ))
        break
      }
      case 'space':
      default:
        break
    }
  })
  return elements
}
