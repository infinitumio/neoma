// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Task parsing from plain Markdown checkboxes. Tasks stay 100% readable
 * Markdown — metadata is expressed with light, optional annotations that also
 * read fine as text:
 *
 *   - [ ] Read chapter 3 📅 2026-08-01 ⏫ #course/biology 🔁 every week
 *   - [ ] Email supervisor [due:: 2026-08-02] [priority:: low]
 *
 * Supported (all optional):
 *   • due date   — `📅 YYYY-MM-DD` or `[due:: YYYY-MM-DD]`
 *   • priority   — `⏫`/`🔼`/`🔽` or `[priority:: high|medium|low]`
 *   • course     — `#course/<name>` tag or `[course:: <name>]`
 *   • related    — the first `[[wiki link]]` in the task
 *   • recurrence — `🔁 <rule>` or `[repeat:: <rule>]`
 */
import { basename } from '@/utils/paths'

export type Priority = 'high' | 'medium' | 'low' | 'none'

export interface Task {
  id: string
  text: string
  done: boolean
  path: string
  pageName: string
  /** 0-based line index within the note */
  line: number
  due?: string
  priority: Priority
  course?: string
  related?: string
  recurrence?: string
}

const CHECKBOX_RE = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]\s+(.*)$/
const DUE_RE = /(?:📅\s*|\[due::\s*)(\d{4}-\d{2}-\d{2})\]?/
const RECUR_RE = /🔁\s*([^\n[\]]+)|\[repeat::\s*([^\]]+)\]/
const COURSE_TAG_RE = /#course\/([\w-]+)/
const COURSE_FIELD_RE = /\[course::\s*([^\]]+)\]/
const PRIORITY_FIELD_RE = /\[priority::\s*(high|medium|low)\]/i
const WIKILINK_RE = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/

function priorityOf(text: string): Priority {
  const field = PRIORITY_FIELD_RE.exec(text)
  if (field) return field[1].toLowerCase() as Priority
  if (text.includes('⏫')) return 'high'
  if (text.includes('🔼')) return 'medium'
  if (text.includes('🔽')) return 'low'
  return 'none'
}

/** Strip the metadata annotations, leaving readable task text. */
function cleanText(text: string): string {
  return text
    .replace(DUE_RE, '')
    .replace(RECUR_RE, '')
    .replace(COURSE_FIELD_RE, '')
    .replace(PRIORITY_FIELD_RE, '')
    .replace(/[⏫🔼🔽]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const TASK_TAG_RE = /(^|\s)#task\b/i
const HEADING_LINE_RE = /^#{1,6}\s+(.+?)\s*#*$/

/** A heading that turns the checkboxes beneath it into tasks. */
export function isTasksHeading(heading: string | undefined): boolean {
  return !!heading && /^(tasks?|to[-\s]?dos?)$/i.test(heading.trim())
}

/**
 * Whether a checkbox itself carries task metadata — a due date, priority,
 * course, recurrence, or an explicit `#task` tag. (Checkboxes under a
 * "Tasks"/"To-do" heading are also tasks; see parseTasks.)
 */
export function isTaskCheckbox(body: string): boolean {
  return (
    TASK_TAG_RE.test(body) ||
    DUE_RE.test(body) ||
    RECUR_RE.test(body) ||
    COURSE_FIELD_RE.test(body) ||
    COURSE_TAG_RE.test(body) ||
    priorityOf(body) !== 'none'
  )
}

export function parseTasks(path: string, markdown: string): Task[] {
  const pageName = basename(path).replace(/\.md$/i, '')
  const tasks: Task[] = []
  const lines = markdown.split('\n')
  let inFence = false
  let heading = ''
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    if (inFence) return
    const h = HEADING_LINE_RE.exec(line)
    if (h) {
      heading = h[1].trim()
      return
    }
    const m = CHECKBOX_RE.exec(line)
    if (!m) return
    const body = m[3]
    // A task if it carries metadata OR sits under a "Tasks"/"To-do" heading.
    if (!isTaskCheckbox(body) && !isTasksHeading(heading)) return
    const due = DUE_RE.exec(body)?.[1]
    const recurMatch = RECUR_RE.exec(body)
    const recur = (recurMatch?.[1] ?? recurMatch?.[2])?.trim()
    const course = COURSE_FIELD_RE.exec(body)?.[1]?.trim() ?? COURSE_TAG_RE.exec(body)?.[1]
    const related = WIKILINK_RE.exec(body)?.[1]?.trim()
    tasks.push({
      id: `${path}:${i}`,
      text: cleanText(body).replace(TASK_TAG_RE, '$1').trim(),
      done: m[2] !== ' ',
      path,
      pageName,
      line: i,
      due,
      priority: priorityOf(body),
      course,
      related,
      recurrence: recur,
    })
  })
  return tasks
}

/** Set (or clear, when `dueIso` is empty) a task's due date on a given line,
 *  keeping it as readable `📅 YYYY-MM-DD` Markdown. */
export function setTaskDueInLine(content: string, line: number, dueIso: string): string {
  const lines = content.split('\n')
  let target = lines[line]
  if (target === undefined || !CHECKBOX_RE.test(target)) return content
  // Drop any existing due marker (emoji or [due:: …]) first.
  target = target
    .replace(DUE_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/, '')
  if (dueIso) target = `${target} 📅 ${dueIso}`
  lines[line] = target
  return lines.join('\n')
}

/** Toggle the checkbox on a specific 0-based line, returning new content. */
export function toggleTaskAtLine(content: string, line: number): string {
  const lines = content.split('\n')
  const target = lines[line]
  if (target === undefined) return content
  lines[line] = target.replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]/, (_full, prefix, mark) => {
    return `${prefix}[${mark === ' ' ? 'x' : ' '}]`
  })
  return lines.join('\n')
}

// ---- Date helpers (local, no timezone surprises) --------------------------

/** Days from today (local) to an ISO date; negative = overdue, null = no date. */
export function daysFromToday(due: string | undefined, todayIso: string): number | null {
  if (!due) return null
  const target = new Date(due)
  const today = new Date(todayIso)
  if (Number.isNaN(target.getTime())) return null
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2, none: 3 }
