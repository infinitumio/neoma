// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Fast, regex-based metadata extraction from note text. Runs in the index
 * Web Worker for every note in the vault, so it avoids a full AST parse.
 */
import type { Heading, NoteMeta, WikiLink } from '@/types'
import { parseFrontmatter, asStringArray } from './frontmatter'
import { slugify } from '@/utils/misc'
import { stem } from '@/utils/paths'

const WIKI_LINK_RE = /(!?)\[\[([^\][\n]+?)\]\]/g
const MD_LINK_RE = /(!?)\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const TAG_RE = /(^|[\s(])#([\p{L}\p{N}/_-]+)/gmu
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/gm
const CITATION_RE = /\[@([\w:.#$%&+?<>~/-]+)(?:[^\]]*)?\]|(?<=\s|^)@([\w][\w:.#$%&+?<>~/-]*)/g

/**
 * Replace fenced code blocks, inline code and math with spaces so pattern
 * scans skip them while every offset stays valid.
 */
export function maskNonProse(body: string): string {
  return body
    .replace(/```[\s\S]*?(?:```|$)/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/~~~[\s\S]*?(?:~~~|$)/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length))
    .replace(/\$\$[\s\S]*?\$\$/g, (m) => m.replace(/[^\n]/g, ' '))
}

export function parseWikiTarget(inner: string): Omit<WikiLink, 'offset' | 'raw'> & { raw: string } {
  let alias: string | undefined
  let target = inner
  const pipe = inner.indexOf('|')
  if (pipe !== -1) {
    alias = inner.slice(pipe + 1).trim() || undefined
    target = inner.slice(0, pipe)
  }
  let heading: string | undefined
  const hash = target.indexOf('#')
  if (hash !== -1) {
    heading = target.slice(hash + 1).trim() || undefined
    target = target.slice(0, hash)
  }
  return { raw: inner, target: target.trim(), heading, alias }
}

export function extractLinks(body: string, bodyOffset = 0): WikiLink[] {
  const masked = maskNonProse(body)
  const links: WikiLink[] = []
  for (const m of masked.matchAll(WIKI_LINK_RE)) {
    if (m[1] === '!') continue // embeds are attachments, not note links
    const parsed = parseWikiTarget(m[2])
    if (!parsed.target) continue
    links.push({ ...parsed, offset: bodyOffset + (m.index ?? 0) })
  }
  for (const m of masked.matchAll(MD_LINK_RE)) {
    if (m[1] === '!') continue
    const href = decodeURIComponent(m[3])
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) continue
    if (!href.toLowerCase().endsWith('.md')) continue
    links.push({
      raw: href,
      target: href.replace(/\.md$/i, ''),
      alias: m[2] || undefined,
      offset: bodyOffset + (m.index ?? 0),
      isMarkdownLink: true,
    })
  }
  return links
}

export function extractTags(body: string, frontmatterTags: string[]): string[] {
  const masked = maskNonProse(body)
  const tags = new Set(frontmatterTags.map((t) => t.replace(/^#/, '')))
  for (const m of masked.matchAll(TAG_RE)) {
    const tag = m[2]
    if (/^\d+$/.test(tag)) continue // ignore bare numbers like issue refs "#42"
    tags.add(tag)
  }
  return [...tags].sort()
}

export function extractHeadings(body: string, bodyOffset = 0): Heading[] {
  const masked = maskNonProse(body)
  const headings: Heading[] = []
  const slugCounts = new Map<string, number>()
  for (const m of masked.matchAll(HEADING_RE)) {
    const text = body.slice((m.index ?? 0) + m[1].length + 1, (m.index ?? 0) + m[0].length).trim()
    const base = slugify(text.replace(/[*_`~[\]]/g, ''))
    const count = slugCounts.get(base) ?? 0
    slugCounts.set(base, count + 1)
    headings.push({
      depth: m[1].length,
      text: text.replace(/[*_`~]/g, ''),
      slug: count === 0 ? base : `${base}-${count}`,
      offset: bodyOffset + (m.index ?? 0),
    })
  }
  return headings
}

export function extractCitations(body: string): string[] {
  const masked = maskNonProse(body)
  const keys = new Set<string>()
  for (const m of masked.matchAll(CITATION_RE)) {
    keys.add(m[1] ?? m[2])
  }
  return [...keys].sort()
}

export function countWords(body: string): number {
  const words = maskNonProse(body)
    .replace(/[#*_>`~[\]()|-]/g, ' ')
    .match(/\S+/g)
  return words ? words.length : 0
}

export interface ExtractInput {
  path: string
  text: string
  createdAt: number
  modifiedAt: number
}

export function extractNoteMeta(input: ExtractInput): NoteMeta {
  const { data, body, bodyOffset } = parseFrontmatter(input.text)
  const name = stem(input.path)
  const frontmatterTags = asStringArray(data.tags)
  const created =
    typeof data.created === 'string' && !isNaN(Date.parse(data.created))
      ? Date.parse(data.created)
      : data.created instanceof Date
        ? data.created.getTime()
        : input.createdAt
  return {
    path: input.path,
    name,
    title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : name,
    frontmatter: data,
    aliases: asStringArray(data.aliases),
    tags: extractTags(body, frontmatterTags),
    links: extractLinks(body, bodyOffset),
    headings: extractHeadings(body, bodyOffset),
    citations: extractCitations(body),
    wordCount: countWords(body),
    charCount: body.length,
    createdAt: created,
    modifiedAt: input.modifiedAt,
  }
}
