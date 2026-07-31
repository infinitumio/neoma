// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Rewrites wiki links / markdown links when a note is renamed. Only link
 * targets are touched — aliases, headings and all other note text stay
 * byte-identical. Nothing is written until the user has reviewed the change.
 */
import { maskNonProse, parseWikiTarget } from '@/markdown/extractMeta'

const WIKI_LINK_RE = /(!?)\[\[([^\][\n]+?)\]\]/g
const MD_LINK_RE = /(!?\[[^\]\n]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g

export interface RewriteResult {
  text: string
  count: number
}

/**
 * @param text        note content
 * @param oldTargets  lower-cased target spellings that referred to the
 *                    renamed note (name, title, aliases, path without .md)
 * @param newTarget   the new wiki target (usually the new note name)
 */
export function rewriteLinks(
  text: string,
  oldTargets: Set<string>,
  newTarget: string,
): RewriteResult {
  const masked = maskNonProse(text)
  let count = 0
  const edits: Array<{ start: number; end: number; replacement: string }> = []

  for (const m of masked.matchAll(WIKI_LINK_RE)) {
    const start = m.index ?? 0
    const inner = m[2]
    const { target, heading, alias } = parseWikiTarget(inner)
    if (!oldTargets.has(target.toLowerCase())) continue
    const rebuilt = `${m[1]}[[${newTarget}${heading ? '#' + heading : ''}${alias ? '|' + alias : ''}]]`
    edits.push({ start, end: start + m[0].length, replacement: rebuilt })
    count++
  }

  for (const m of masked.matchAll(MD_LINK_RE)) {
    const start = m.index ?? 0
    const href = decodeURIComponent(m[2])
    if (!href.toLowerCase().endsWith('.md')) continue
    if (!oldTargets.has(href.replace(/\.md$/i, '').toLowerCase())) continue
    const replacement = `${m[1]}${encodeURI(newTarget)}.md${m[3]}`
    edits.push({ start, end: start + m[0].length, replacement })
    count++
  }

  if (!count) return { text, count: 0 }
  edits.sort((a, b) => a.start - b.start)
  let out = ''
  let cursor = 0
  for (const edit of edits) {
    out += text.slice(cursor, edit.start) + edit.replacement
    cursor = edit.end
  }
  out += text.slice(cursor)
  return { text: out, count }
}
