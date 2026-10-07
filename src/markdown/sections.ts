// SPDX-License-Identifier: AGPL-3.0-or-later
/** Pull a heading's section out of a note, for `![[Note#Heading]]` embeds. */
import { extractHeadings } from './extractMeta'
import { parseFrontmatter } from './frontmatter'
import { slugify } from '@/utils/misc'

/**
 * The note body without frontmatter, or, given a heading, that heading and
 * everything under it up to the next heading of the same or higher level.
 * Headings match by text (case-insensitive) or slug. Null if not found.
 */
export function noteSection(markdown: string, heading?: string): string | null {
  const { body } = parseFrontmatter(markdown)
  if (!heading) return body
  const headings = extractHeadings(body)
  const want = heading.trim().toLowerCase()
  const slug = slugify(heading)
  const i = headings.findIndex((h) => h.text.toLowerCase() === want || h.slug === slug)
  if (i === -1) return null
  const start = headings[i]
  const end = headings.slice(i + 1).find((h) => h.depth <= start.depth)
  return body.slice(start.offset, end?.offset).trimEnd()
}
