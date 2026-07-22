// SPDX-License-Identifier: AGPL-3.0-or-later
/** Task parsing and toggling from plain Markdown. */
import { describe, expect, it } from 'vitest'
import { parseTasks, toggleTaskAtLine, setTaskDueInLine, daysFromToday } from '@/tasks/tasks'

describe('parseTasks', () => {
  it('parses a plain checkbox', () => {
    const [t] = parseTasks('page.md', '- [ ] Buy milk')
    expect(t.done).toBe(false)
    expect(t.text).toBe('Buy milk')
    expect(t.pageName).toBe('page')
    expect(t.line).toBe(0)
  })

  it('reads done state', () => {
    expect(parseTasks('p.md', '- [x] done')[0].done).toBe(true)
    expect(parseTasks('p.md', '- [ ] not')[0].done).toBe(false)
  })

  it('extracts an emoji due date and strips it from the text', () => {
    const [t] = parseTasks('p.md', '- [ ] Read chapter 📅 2026-08-01')
    expect(t.due).toBe('2026-08-01')
    expect(t.text).toBe('Read chapter')
  })

  it('extracts a [due:: ] field', () => {
    const [t] = parseTasks('p.md', '- [ ] Email supervisor [due:: 2026-08-02]')
    expect(t.due).toBe('2026-08-02')
    expect(t.text).toBe('Email supervisor')
  })

  it('reads priority from emoji and field', () => {
    expect(parseTasks('p.md', '- [ ] a ⏫')[0].priority).toBe('high')
    expect(parseTasks('p.md', '- [ ] b 🔽')[0].priority).toBe('low')
    expect(parseTasks('p.md', '- [ ] c [priority:: medium]')[0].priority).toBe('medium')
  })

  it('reads course from tag or field, and a related page link', () => {
    const [t] = parseTasks('p.md', '- [ ] Revise #course/biology about [[Cells]]')
    expect(t.course).toBe('biology')
    expect(t.related).toBe('Cells')
  })

  it('reads a recurrence rule', () => {
    const [t] = parseTasks('p.md', '- [ ] Standup 🔁 every week')
    expect(t.recurrence).toBe('every week')
  })

  it('ignores checkboxes inside code fences', () => {
    const md = ['```', '- [ ] not a task', '```', '- [ ] real task'].join('\n')
    const tasks = parseTasks('p.md', md)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].text).toBe('real task')
  })

  it('handles ordered-list tasks', () => {
    expect(parseTasks('p.md', '1. [ ] first')[0].text).toBe('first')
  })
})

describe('toggleTaskAtLine', () => {
  const md = ['# Title', '- [ ] one', '- [x] two'].join('\n')
  it('checks an unchecked line', () => {
    expect(toggleTaskAtLine(md, 1)).toContain('- [x] one')
  })
  it('unchecks a checked line', () => {
    expect(toggleTaskAtLine(md, 2)).toContain('- [ ] two')
  })
  it('is a no-op for a non-task line', () => {
    expect(toggleTaskAtLine(md, 0)).toBe(md)
  })
})

describe('setTaskDueInLine', () => {
  it('adds a due date to a task', () => {
    expect(setTaskDueInLine('- [ ] Buy milk', 0, '2026-08-01')).toBe('- [ ] Buy milk 📅 2026-08-01')
  })
  it('replaces an existing due date', () => {
    const out = setTaskDueInLine('- [ ] Buy milk 📅 2026-08-01', 0, '2026-08-05')
    expect(out).toBe('- [ ] Buy milk 📅 2026-08-05')
  })
  it('clears the due date when empty', () => {
    expect(setTaskDueInLine('- [ ] Buy milk 📅 2026-08-01', 0, '')).toBe('- [ ] Buy milk')
  })
  it('ignores non-task lines', () => {
    expect(setTaskDueInLine('# Heading', 0, '2026-08-01')).toBe('# Heading')
  })
})

describe('daysFromToday', () => {
  it('computes overdue and future', () => {
    expect(daysFromToday('2026-07-20', '2026-07-22')).toBe(-2)
    expect(daysFromToday('2026-07-25', '2026-07-22')).toBe(3)
    expect(daysFromToday(undefined, '2026-07-22')).toBeNull()
  })
})
