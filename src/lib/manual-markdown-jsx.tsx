import type { ReactNode } from 'react'
import type { Tokens } from 'marked'
import type { ManualToken, CalloutToken } from './markdown-tokens'

function renderInline(tokens: Tokens.Generic[]): ReactNode[] {
  return tokens.map((token, i) => {
    switch (token.type) {
      case 'strong':
        return <strong key={i}>{renderInline((token as Tokens.Strong).tokens)}</strong>
      case 'em':
        return <em key={i}>{renderInline((token as Tokens.Em).tokens)}</em>
      case 'link': {
        const link = token as Tokens.Link
        return <a key={i} href={link.href} className="text-brand-primary underline">{renderInline(link.tokens)}</a>
      }
      case 'image':
        return renderImageToken(token as Tokens.Image, i)
      case 'text':
        return (token as Tokens.Text).text
      default:
        return null
    }
  })
}

function renderListItems(items: Tokens.ListItem[]): ReactNode[] {
  return items.map((item, i) => <li key={i}>{renderInline(item.tokens)}</li>)
}

function renderHeadingToken(token: Tokens.Heading, key: number): ReactNode {
  const className = token.depth === 2
    ? 'font-display text-xl uppercase text-brand-primary'
    : 'font-display text-base uppercase text-brand-primary-light'
  const id = token.text.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-+|-+$/g, '')
  return token.depth === 2
    ? <h2 key={key} id={id} className={className}>{token.text}</h2>
    : <h3 key={key} id={id} className={className}>{token.text}</h3>
}

function renderParagraphToken(token: Tokens.Paragraph, key: number): ReactNode {
  return <p key={key}>{renderInline(token.tokens)}</p>
}

function renderListToken(token: Tokens.List, key: number): ReactNode {
  return token.ordered
    ? <ol key={key} className="list-decimal pl-6 space-y-1">{renderListItems(token.items)}</ol>
    : <ul key={key} className="list-disc pl-6 space-y-1">{renderListItems(token.items)}</ul>
}

function renderImageToken(token: Tokens.Image, key: number): ReactNode {
  return (
    <img
      key={key}
      src={`${import.meta.env.BASE_URL}anleitung/${token.href}`}
      alt={token.text}
      className="rounded-md border border-border shadow-sm max-w-full"
    />
  )
}

function renderCalloutToken(token: CalloutToken, key: number): ReactNode {
  return (
    <div key={key} className="rounded-md border border-brand-primary/30 bg-tint p-4 text-sm">
      <p className="font-semibold text-brand-primary mb-1">{token.title}</p>
      <div>{renderManualMarkdownToJsx(token.tokens as ManualToken[])}</div>
    </div>
  )
}

export function renderManualMarkdownToJsx(tokens: ManualToken[]): ReactNode[] {
  return tokens.map((token, i) => {
    switch (token.type) {
      case 'heading':
        return renderHeadingToken(token as Tokens.Heading, i)
      case 'paragraph':
        return renderParagraphToken(token as Tokens.Paragraph, i)
      case 'list':
        return renderListToken(token as Tokens.List, i)
      case 'image':
        return renderImageToken(token as Tokens.Image, i)
      case 'callout':
        return renderCalloutToken(token as CalloutToken, i)
      case 'space':
        return null
      default:
        return null
    }
  })
}
