import { marked, type Token } from 'marked'

export interface CalloutToken {
  type: 'callout'
  raw: string
  title: string
  tokens: Token[]
}

export type ManualToken = Token | CalloutToken

const CALLOUT_PATTERN = /^::: callout (.+)\n([\s\S]*?)\n:::$/gm

// marked has no native concept of a callout/admonition block, so callout regions are cut out
// of the raw markdown text before tokenizing (replaced by a unique placeholder line), then
// re-inserted as a single `callout` token whose own content is tokenized recursively -- this
// keeps normal markdown before/after the callout completely unaffected.
export function tokenizeManualMarkdown(markdown: string): ManualToken[] {
  const callouts: CalloutToken[] = []
  const withPlaceholders = markdown.replace(CALLOUT_PATTERN, (raw, title: string, body: string) => {
    const placeholder = `CALLOUT_PLACEHOLDER_${callouts.length}`
    callouts.push({ type: 'callout', raw, title, tokens: marked.lexer(body) })
    return placeholder
  })

  const rawTokens = marked.lexer(withPlaceholders)
  const result: ManualToken[] = []
  for (const token of rawTokens) {
    if (token.type === 'paragraph' && /^CALLOUT_PLACEHOLDER_\d+$/.test(token.text.trim())) {
      const index = Number(token.text.trim().replace('CALLOUT_PLACEHOLDER_', ''))
      result.push(callouts[index])
    } else {
      result.push(token)
    }
  }
  return result
}
