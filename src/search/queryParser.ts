// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Parses the search-box mini language:
 *
 *   transformer "exact phrase" -excluded tag:experiments path:Projects type:literature
 */

export interface ParsedQuery {
  terms: string[]
  phrases: string[]
  excluded: string[]
  tag?: string
  path?: string
  type?: string
}

const TOKEN_RE = /"([^"]*)"|(\S+)/g

export function parseQuery(input: string): ParsedQuery {
  const parsed: ParsedQuery = { terms: [], phrases: [], excluded: [] }
  for (const match of input.matchAll(TOKEN_RE)) {
    if (match[1] !== undefined) {
      if (match[1].trim()) parsed.phrases.push(match[1].trim())
      continue
    }
    const token = match[2]
    const lower = token.toLowerCase()
    if (lower.startsWith('tag:')) {
      parsed.tag = token.slice(4).replace(/^#/, '')
    } else if (lower.startsWith('path:')) {
      parsed.path = token.slice(5)
    } else if (lower.startsWith('type:')) {
      parsed.type = token.slice(5)
    } else if (token.startsWith('-') && token.length > 1) {
      parsed.excluded.push(token.slice(1))
    } else if (token.startsWith('#') && token.length > 1) {
      parsed.tag = token.slice(1)
    } else {
      parsed.terms.push(token)
    }
  }
  return parsed
}
