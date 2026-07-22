// SPDX-License-Identifier: AGPL-3.0-or-later
/** Minimal .ics (iCalendar) parsing. */
import { describe, expect, it } from 'vitest'
import { parseIcs } from '@/calendar/ics'

const SAMPLE = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'SUMMARY:Lecture: Intro to ML',
  'DTSTART;VALUE=DATE:20260801',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'SUMMARY:Team standup',
  'DTSTART:20260802T090000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('parseIcs', () => {
  it('parses date-only and datetime VEVENTs', () => {
    const events = parseIcs(SAMPLE, 'my-cal')
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ date: '2026-08-01', title: 'Lecture: Intro to ML', kind: 'ics' })
    expect(events[1].date).toBe('2026-08-02')
    expect(events[0].course).toBe('my-cal')
  })

  it('unfolds continuation lines', () => {
    const folded = [
      'BEGIN:VEVENT',
      'SUMMARY:A very long title that has been',
      '  folded across two lines',
      'DTSTART;VALUE=DATE:20260901',
      'END:VEVENT',
    ].join('\r\n')
    expect(parseIcs(folded)[0].title).toBe('A very long title that has been folded across two lines')
  })

  it('unescapes commas and semicolons', () => {
    const esc = ['BEGIN:VEVENT', 'SUMMARY:Buy milk\\, eggs\\; bread', 'DTSTART:20260901', 'END:VEVENT'].join(
      '\r\n',
    )
    expect(parseIcs(esc)[0].title).toBe('Buy milk, eggs; bread')
  })

  it('skips events without a start date', () => {
    const noDate = ['BEGIN:VEVENT', 'SUMMARY:No date', 'END:VEVENT'].join('\r\n')
    expect(parseIcs(noDate)).toHaveLength(0)
  })
})
