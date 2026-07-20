// SPDX-License-Identifier: AGPL-3.0-or-later
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'

export interface FrontmatterResult {
  /** parsed fields; empty object when no frontmatter block exists */
  data: Record<string, unknown>
  /** note body without the frontmatter block */
  body: string
  /** character offset where the body starts in the original text */
  bodyOffset: number
  /** raw frontmatter text (without delimiters), preserved verbatim */
  raw: string | null
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

/**
 * Parse a YAML frontmatter block. Unknown fields are preserved because we
 * keep the raw text and only ever re-serialise the fields we changed on top
 * of the original document structure.
 */
export function parseFrontmatter(text: string): FrontmatterResult {
  const match = FRONTMATTER_RE.exec(text)
  if (!match) return { data: {}, body: text, bodyOffset: 0, raw: null }
  let data: Record<string, unknown> = {}
  try {
    const parsed = parseYaml(match[1])
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>
    }
  } catch {
    // Invalid YAML: treat the block as opaque text and leave it untouched.
  }
  return {
    data,
    body: text.slice(match[0].length),
    bodyOffset: match[0].length,
    raw: match[1],
  }
}

/**
 * Update (or create) frontmatter fields in a note, preserving every field we
 * do not explicitly set. Returns the full new note text.
 */
export function updateFrontmatter(text: string, updates: Record<string, unknown>): string {
  const { data, body, raw } = parseFrontmatter(text)
  const merged: Record<string, unknown> = { ...data }
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) delete merged[key]
    else merged[key] = value
  }
  if (raw !== null && Object.keys(data).length === 0) {
    // Unparseable YAML — never rewrite what we cannot round-trip.
    return text
  }
  if (Object.keys(merged).length === 0) return body
  const yamlText = stringifyYaml(merged).trimEnd()
  return `---\n${yamlText}\n---\n${body}`
}

export function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}
