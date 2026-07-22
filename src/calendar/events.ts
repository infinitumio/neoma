// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Calendar events, derived locally from the vault. Events come from note
 * frontmatter (`date`, `due`, `exam-date`) and from task due dates. Nothing
 * is fetched from the network; external calendars are an optional add-on.
 */
import type { NoteMeta } from '@/types'

export type EventKind = 'note' | 'exam' | 'task' | 'ics'

export interface CalEvent {
  /** ISO date (YYYY-MM-DD) */
  date: string
  title: string
  path: string
  kind: EventKind
  type?: string
  course?: string
  done?: boolean
  /** for tasks: the source line, so it can be opened/toggled */
  line?: number
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}/

function asDate(v: unknown): string | undefined {
  if (typeof v === 'string' && ISO_RE.test(v.trim())) return v.trim().slice(0, 10)
  return undefined
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

/** Build events from note frontmatter. Pure — safe to unit test. */
export function eventsFromMetas(metas: NoteMeta[]): CalEvent[] {
  const events: CalEvent[] = []
  for (const meta of metas) {
    const fm = meta.frontmatter
    const type = str(fm.type)
    const course = str(fm.course)
    const examDate = asDate(fm['exam-date'])
    if (examDate) {
      events.push({ date: examDate, title: meta.title, path: meta.path, kind: 'exam', type, course })
    }
    const date = asDate(fm.date) ?? asDate(fm.due)
    // Don't double-count an exam page whose `date` equals its exam date.
    if (date && date !== examDate) {
      events.push({
        date,
        title: meta.title,
        path: meta.path,
        kind: type === 'exam' ? 'exam' : 'note',
        type,
        course,
      })
    }
  }
  return events
}

const COLORS: Record<string, string> = {
  exam: '#e5484d',
  task: '#4c8dff',
  note: '#30a46c',
  ics: '#8e6ee6',
}

/** A stable colour for an event (by course when present, else by kind). */
export function eventColor(ev: CalEvent): string {
  if (ev.kind === 'exam') return COLORS.exam
  if (ev.course) {
    // Hash the course name to a hue for consistent per-course colours.
    let h = 0
    for (let i = 0; i < ev.course.length; i++) h = (h * 31 + ev.course.charCodeAt(i)) % 360
    return `hsl(${h} 60% 55%)`
  }
  return COLORS[ev.kind] ?? COLORS.note
}
