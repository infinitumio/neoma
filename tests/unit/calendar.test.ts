// SPDX-License-Identifier: AGPL-3.0-or-later
/** Calendar events derived from note frontmatter. */
import { describe, expect, it } from 'vitest'
import { eventsFromMetas, eventColor } from '@/calendar/events'
import type { NoteMeta } from '@/types'

function meta(path: string, frontmatter: Record<string, unknown>): NoteMeta {
  return {
    path,
    name: path,
    title: path.replace(/\.md$/, ''),
    frontmatter,
    aliases: [],
    tags: [],
    links: [],
    headings: [],
    citations: [],
    wordCount: 0,
    charCount: 0,
    createdAt: 0,
    modifiedAt: 0,
  }
}

describe('eventsFromMetas', () => {
  it('creates an event from a `date` field', () => {
    const [e] = eventsFromMetas([meta('a.md', { date: '2026-08-01' })])
    expect(e).toMatchObject({ date: '2026-08-01', path: 'a.md', kind: 'note' })
  })

  it('creates an exam event from `exam-date` and type', () => {
    const events = eventsFromMetas([
      meta('exam.md', { type: 'exam', 'exam-date': '2026-09-10', course: 'Maths' }),
    ])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'exam', date: '2026-09-10', course: 'Maths' })
  })

  it('falls back to `due` when there is no `date`', () => {
    const [e] = eventsFromMetas([meta('b.md', { due: '2026-08-05' })])
    expect(e.date).toBe('2026-08-05')
  })

  it('ignores non-ISO or missing dates', () => {
    expect(eventsFromMetas([meta('c.md', { date: 'someday' })])).toHaveLength(0)
    expect(eventsFromMetas([meta('d.md', {})])).toHaveLength(0)
  })

  it('does not double-count when date equals exam-date', () => {
    const events = eventsFromMetas([
      meta('e.md', { type: 'exam', 'exam-date': '2026-09-10', date: '2026-09-10' }),
    ])
    expect(events).toHaveLength(1)
  })

  it('colours exams red and courses consistently', () => {
    expect(eventColor({ date: 'x', title: 't', path: 'p', kind: 'exam' })).toBe('#e5484d')
    const a = eventColor({ date: 'x', title: 't', path: 'p', kind: 'note', course: 'Bio' })
    const b = eventColor({ date: 'y', title: 'u', path: 'q', kind: 'task', course: 'Bio' })
    expect(a).toBe(b)
  })
})
