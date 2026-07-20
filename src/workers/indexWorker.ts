// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The index worker owns full-text search (MiniSearch) and note-metadata
 * extraction so large vaults never block the UI thread. It keeps every
 * note's text in memory; the main thread only holds lightweight metadata.
 */
import MiniSearch from 'minisearch'
import type { NoteMeta, SearchFilters, SearchResultItem } from '@/types'
import { extractNoteMeta } from '@/markdown/extractMeta'
import { parseQuery } from '@/search/queryParser'
import { escapeRegExp } from '@/utils/misc'
import { isWithin } from '@/utils/paths'

interface DocRecord {
  meta: NoteMeta
  text: string
}

const docs = new Map<string, DocRecord>()

function createIndex() {
  return new MiniSearch({
    idField: 'path',
    fields: ['title', 'text', 'tags', 'path', 'citations'],
    storeFields: ['path'],
    searchOptions: {
      boost: { title: 3, tags: 2, citations: 2 },
      prefix: true,
      fuzzy: 0.15,
      combineWith: 'AND',
    },
  })
}

let mini = createIndex()

function toDoc(record: DocRecord) {
  return {
    path: record.meta.path,
    title: record.meta.title,
    text: record.text,
    tags: record.meta.tags.join(' '),
    citations: record.meta.citations.join(' '),
  }
}

function upsert(
  items: Array<{ path: string; text: string; createdAt: number; modifiedAt: number }>,
) {
  const metas: NoteMeta[] = []
  for (const item of items) {
    const meta = extractNoteMeta(item)
    const record = { meta, text: item.text }
    if (docs.has(item.path)) mini.discard(item.path)
    docs.set(item.path, record)
    mini.add(toDoc(record))
    metas.push(meta)
  }
  return metas
}

function remove(path: string) {
  if (docs.has(path)) {
    mini.discard(path)
    docs.delete(path)
  }
}

function makeSnippets(
  text: string,
  patterns: RegExp[],
  maxSnippets = 3,
): SearchResultItem['snippets'] {
  const snippets: SearchResultItem['snippets'] = []
  const seenLines = new Set<number>()
  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) && snippets.length < maxSnippets) {
      const lineStart = text.lastIndexOf('\n', match.index) + 1
      if (seenLines.has(lineStart)) continue
      seenLines.add(lineStart)
      let lineEnd = text.indexOf('\n', match.index)
      if (lineEnd === -1) lineEnd = text.length
      const raw = text.slice(lineStart, lineEnd)
      const clipStart = Math.max(0, match.index - lineStart - 80)
      const snippetText = (clipStart > 0 ? '…' : '') + raw.slice(clipStart, clipStart + 240)
      const offsetInSnippet = match.index - lineStart - clipStart + (clipStart > 0 ? 1 : 0)
      snippets.push({
        text: snippetText,
        ranges: [[offsetInSnippet, offsetInSnippet + match[0].length]],
      })
    }
    if (snippets.length >= maxSnippets) break
  }
  return snippets
}

function query(input: string, filters: SearchFilters = {}): SearchResultItem[] {
  const parsed = parseQuery(input)
  const termQuery = parsed.terms.join(' ')

  let candidates: Array<{ path: string; score: number }>
  if (termQuery) {
    candidates = mini.search(termQuery).map((r) => ({ path: r.id as string, score: r.score }))
  } else {
    candidates = [...docs.keys()].map((path) => ({ path, score: 1 }))
  }

  const results: SearchResultItem[] = []
  for (const candidate of candidates) {
    const record = docs.get(candidate.path)
    if (!record) continue
    const { meta, text } = record
    const haystack = `${meta.title}\n${text}`.toLowerCase()

    if (parsed.phrases.some((p) => !haystack.includes(p.toLowerCase()))) continue
    if (parsed.excluded.some((x) => haystack.includes(x.toLowerCase()))) continue
    const tag = parsed.tag ?? filters.tag
    if (tag && !meta.tags.some((t) => t === tag || t.startsWith(tag + '/'))) continue
    const folder = parsed.path ?? filters.folder
    if (folder && !isWithin(folder.replace(/\/$/, ''), meta.path)) continue
    const noteType = parsed.type ?? filters.noteType
    if (noteType && String(meta.frontmatter.type ?? '') !== noteType) continue
    if (filters.createdAfter && meta.createdAt < filters.createdAfter) continue
    if (filters.createdBefore && meta.createdAt > filters.createdBefore) continue
    if (filters.modifiedAfter && meta.modifiedAt < filters.modifiedAfter) continue
    if (filters.modifiedBefore && meta.modifiedAt > filters.modifiedBefore) continue

    const patterns = [
      ...parsed.phrases.map((p) => new RegExp(escapeRegExp(p), 'gi')),
      ...parsed.terms.map((t) => new RegExp(escapeRegExp(t), 'gi')),
    ]
    results.push({
      path: meta.path,
      title: meta.title,
      score: candidate.score,
      snippets: patterns.length ? makeSnippets(text, patterns) : [],
    })
    if (results.length >= 200) break
  }
  return results
}

/** Plain-text mentions of any term, excluding text inside wiki links. */
function mentions(terms: string[], excludePath: string): SearchResultItem[] {
  const results: SearchResultItem[] = []
  const patterns = terms
    .filter((t) => t.length > 2)
    .map((t) => new RegExp(`(?<!\\[\\[[^\\]]*)\\b${escapeRegExp(t)}\\b`, 'gi'))
  if (!patterns.length) return results
  for (const [path, record] of docs) {
    if (path === excludePath) continue
    const snippets = makeSnippets(record.text, patterns, 2)
    if (snippets.length) {
      results.push({ path, title: record.meta.title, score: 1, snippets })
    }
    if (results.length >= 50) break
  }
  return results
}

/** Line excerpts around given character offsets (backlink context). */
function contexts(items: Array<{ path: string; offset: number }>): string[] {
  return items.map(({ path, offset }) => {
    const record = docs.get(path)
    if (!record) return ''
    const text = record.text
    const clamped = Math.min(Math.max(offset, 0), Math.max(text.length - 1, 0))
    const lineStart = text.lastIndexOf('\n', clamped) + 1
    let lineEnd = text.indexOf('\n', clamped)
    if (lineEnd === -1) lineEnd = text.length
    return text.slice(lineStart, lineEnd).trim().slice(0, 300)
  })
}

interface WorkerRequest {
  id: number
  op: string
  payload?: any
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, op, payload } = event.data
  try {
    let result: unknown
    switch (op) {
      case 'upsert':
        result = upsert(payload.items)
        break
      case 'remove':
        remove(payload.path)
        break
      case 'rename': {
        const record = docs.get(payload.oldPath)
        if (record) {
          remove(payload.oldPath)
          result = upsert([
            {
              path: payload.newPath,
              text: record.text,
              createdAt: record.meta.createdAt,
              modifiedAt: Date.now(),
            },
          ])
        }
        break
      }
      case 'query':
        result = query(payload.query, payload.filters)
        break
      case 'mentions':
        result = mentions(payload.terms, payload.excludePath)
        break
      case 'contexts':
        result = contexts(payload.items)
        break
      case 'clear':
        docs.clear()
        mini = createIndex()
        break
      default:
        throw new Error(`Unknown index worker op: ${op}`)
    }
    self.postMessage({ id, result })
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) })
  }
}
