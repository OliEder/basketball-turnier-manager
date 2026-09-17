import { Fragment, type ReactNode } from 'react'
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
      case 'text': {
        const textToken = token as Tokens.Text
        // A `text` token can itself wrap nested inline tokens (e.g. a list item whose text
        // contains a link or bold run gets tokenized as a `text` token with its own `.tokens`
        // array) -- recurse into those rather than falling back to the raw, markup-stripped text.
        return textToken.tokens
          ? <Fragment key={i}>{renderInline(textToken.tokens)}</Fragment>
          : textToken.text
      }
      default:
        return null
    }
  })
}

function renderListItems(items: Tokens.ListItem[]): ReactNode[] {
  return items.map((item, i) => <li key={i}>{renderInline(item.tokens)}</li>)
}

/** A heading token that has been annotated with its resolved anchor id (see `extractAnchorId`). */
type HeadingWithId = Tokens.Heading & { __anchorId?: string }

const ANCHOR_COMMENT_PATTERN = /^<!-- #(\S+) -->$/

function slugifyHeadingText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-+|-+$/g, '')
}

function headingId(token: HeadingWithId): string {
  return token.__anchorId ?? slugifyHeadingText(token.text)
}

function renderHeadingToken(token: HeadingWithId, key: number): ReactNode {
  const className = token.depth === 2
    ? 'font-display text-xl uppercase text-brand-primary'
    : 'font-display text-base uppercase text-brand-primary-light'
  const id = headingId(token)
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

function renderToken(token: ManualToken, key: number): ReactNode {
  switch (token.type) {
    case 'heading':
      return renderHeadingToken(token as Tokens.Heading, key)
    case 'paragraph':
      return renderParagraphToken(token as Tokens.Paragraph, key)
    case 'list':
      return renderListToken(token as Tokens.List, key)
    case 'image':
      return renderImageToken(token as Tokens.Image, key)
    case 'callout':
      return renderCalloutToken(token as CalloutToken, key)
    case 'space':
      return null
    default:
      return null
  }
}

interface SubsectionGroup {
  heading: Tokens.Heading
  children: ManualToken[]
}

interface SectionGroup {
  heading: Tokens.Heading | null
  children: ManualToken[]
  subsections: SubsectionGroup[]
}

/** Groups depth-3 headings within a single section's tokens into nested subsection groups. */
function groupSubsections(tokens: ManualToken[]): { children: ManualToken[]; subsections: SubsectionGroup[] } {
  const children: ManualToken[] = []
  const subsections: SubsectionGroup[] = []
  let current: SubsectionGroup | null = null

  for (const token of tokens) {
    if (token.type === 'heading' && (token as Tokens.Heading).depth === 3) {
      current = { heading: token as Tokens.Heading, children: [] }
      subsections.push(current)
      continue
    }
    if (current) {
      current.children.push(token)
    } else {
      children.push(token)
    }
  }

  return { children, subsections }
}

/** Groups a flat token array into depth-2 sections (each with its own depth-3 subsections). */
function groupSections(tokens: ManualToken[]): SectionGroup[] {
  const groups: SectionGroup[] = []
  let currentTokens: ManualToken[] | null = null
  let currentHeading: Tokens.Heading | null = null
  let leading: ManualToken[] = []

  const flush = () => {
    if (currentHeading) {
      const { children, subsections } = groupSubsections(currentTokens ?? [])
      groups.push({ heading: currentHeading, children, subsections })
    }
  }

  for (const token of tokens) {
    if (token.type === 'heading' && (token as Tokens.Heading).depth === 2) {
      flush()
      currentHeading = token as Tokens.Heading
      currentTokens = []
      continue
    }
    if (currentHeading) {
      currentTokens!.push(token)
    } else {
      leading.push(token)
    }
  }
  flush()

  if (leading.length > 0) {
    groups.unshift({ heading: null, children: leading, subsections: [] })
  }

  return groups
}

function renderSubsectionGroup(group: SubsectionGroup, key: number): ReactNode {
  const id = headingId(group.heading as HeadingWithId)
  return (
    <div key={key} id={id} className="space-y-3">
      {renderHeadingToken(group.heading, 0)}
      {group.children.map((token, i) => renderToken(token, i + 1))}
    </div>
  )
}

function renderSectionGroup(group: SectionGroup, key: number): ReactNode {
  if (!group.heading) {
    // Leading content before any depth-2 heading: render unwrapped rather than losing it.
    return <Fragment key={key}>{group.children.map((token, i) => renderToken(token, i))}</Fragment>
  }

  const id = headingId(group.heading as HeadingWithId)
  return (
    <section key={key} id={id} className="space-y-4">
      {renderHeadingToken(group.heading, 0)}
      {group.children.map((token, i) => renderToken(token, i + 1))}
      {group.subsections.map((sub, i) => renderSubsectionGroup(sub, i))}
    </section>
  )
}

/**
 * Resolves each heading's anchor id from an immediately following `<!-- #id -->` HTML comment
 * token (emitted by marked as a sibling right after the `heading` token it annotates), and drops
 * those comment tokens from the array so they're never rendered as visible content. Headings
 * without such a comment are left untouched and fall back to slugifying their text at render time.
 */
function resolveAnchorIds(tokens: ManualToken[]): ManualToken[] {
  const result: ManualToken[] = []
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token.type === 'html') {
      // Anchor comments are only ever consumed via the heading lookahead below; any other
      // `html` token (there shouldn't be any in this app's manual content) is also skipped,
      // since raw HTML must never leak into the rendered output.
      continue
    }
    if (token.type === 'heading') {
      const next = tokens[i + 1]
      const match = next?.type === 'html' ? next.raw.trim().match(ANCHOR_COMMENT_PATTERN) : null
      if (match) {
        result.push({ ...token, __anchorId: match[1] } as HeadingWithId)
        continue
      }
    }
    result.push(token)
  }
  return result
}

export function renderManualMarkdownToJsx(tokens: ManualToken[]): ReactNode[] {
  const groups = groupSections(resolveAnchorIds(tokens))
  return groups.map((group, i) => renderSectionGroup(group, i))
}
