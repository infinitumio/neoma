// SPDX-License-Identifier: AGPL-3.0-or-later
/** Extract the heading hierarchy (table of contents) from a note's markdown. */
import { slugify } from '@/utils/misc'

export interface OutlineItem {
  /** Heading level, 1–6. */
  level: number
  /** Display text (markdown emphasis stripped). */
  text: string
  /** Slug matching the reading-view heading id (see extractMeta). */
  slug: string
  /** 0-based line index in the document. */
  line: number
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const FENCE_RE = /^\s*(```|~~~)/

/** Parse `#`..`######` headings, skipping frontmatter and fenced code. */
export function parseOutline(content: string): OutlineItem[] {
  const lines = content.split('\n')
  const items: OutlineItem[] = []
  let inFence = false
  let start = 0

  // Skip a leading YAML frontmatter block.
  if (lines[0]?.trim() === '---') {
    const end = lines.indexOf('---', 1)
    if (end !== -1) start = end + 1
  }

  for (let i = start; i < lines.length; i++) {
    const line = lines[i]
    if (FENCE_RE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = HEADING_RE.exec(line)
    if (!m) continue
    const raw = m[2].trim()
    items.push({
      level: m[1].length,
      text: raw.replace(/[*_`~]/g, ''),
      slug: slugify(raw.replace(/[*_`~[\]]/g, '')),
      line: i,
    })
  }
  return items
}
