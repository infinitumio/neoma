// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { expandTemplate } from '@/templates/service'
import { BUILTIN_TEMPLATES } from '@/templates/builtins'
import { formatDate, parseDate, isoDate, addDays } from '@/utils/dates'

describe('expandTemplate', () => {
  const date = new Date(2026, 6, 20, 14, 30) // 20 July 2026, local time

  it('replaces title, date and time placeholders', () => {
    const out = expandTemplate('# {{title}} on {{date}} at {{time}}', 'My Note', date)
    expect(out).toBe('# My Note on 2026-07-20 at 14:30')
  })

  it('supports custom date formats', () => {
    expect(expandTemplate('{{date:DD MMM YYYY}}', 'x', date)).toBe('20 Jul 2026')
  })

  it('all built-in templates expand without leftovers', () => {
    for (const template of BUILTIN_TEMPLATES) {
      const out = expandTemplate(template.content, 'T', date)
      expect(out).not.toMatch(/\{\{(title|date|time)/)
    }
  })
})

describe('date helpers', () => {
  const date = new Date(2026, 0, 5)

  it('formats with token subset', () => {
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2026-01-05')
    expect(formatDate(date, 'dddd, DD MMMM YYYY')).toBe('Monday, 05 January 2026')
  })

  it('round-trips parseDate', () => {
    const text = formatDate(date, 'YYYY-MM-DD')
    expect(parseDate(text, 'YYYY-MM-DD')?.getTime()).toBe(date.getTime())
    expect(parseDate('garbage', 'YYYY-MM-DD')).toBeNull()
  })

  it('isoDate and addDays behave in local time', () => {
    expect(isoDate(date)).toBe('2026-01-05')
    expect(isoDate(addDays(date, 27))).toBe('2026-02-01')
  })
})
