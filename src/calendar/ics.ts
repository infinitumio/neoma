// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Minimal iCalendar (.ics) reader — enough to bring events from an exported or
 * subscribed calendar (Google, Outlook, Apple all export .ics) into neoma's
 * calendar as read-only entries. Fully offline: the user imports a file they
 * already have; nothing is fetched here. Subscribing to a live URL (which does
 * need the network) is an optional, clearly-separated add-on.
 */
import type { CalEvent } from './events'

/** Unfold RFC 5545 line folding (continuation lines start with a space/tab). */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out
}

/** A property line `NAME;PARAM=x:VALUE` → { name, value }. */
function prop(line: string): { name: string; value: string } | null {
  const colon = line.indexOf(':')
  if (colon === -1) return null
  const name = line.slice(0, colon).split(';')[0].toUpperCase()
  return { name, value: line.slice(colon + 1) }
}

/** `20260801` or `20260801T090000Z` → `2026-08-01`. */
function toIsoDate(value: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(value.trim())
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

function unescape(value: string): string {
  return value
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

/** Parse the VEVENTs of an .ics document into calendar events. */
export function parseIcs(text: string, source = 'calendar'): CalEvent[] {
  const lines = unfold(text)
  const events: CalEvent[] = []
  let cur: { title?: string; date?: string } | null = null
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === 'BEGIN:VEVENT') {
      cur = {}
      continue
    }
    if (trimmed === 'END:VEVENT') {
      if (cur?.date) {
        events.push({
          date: cur.date,
          title: cur.title?.trim() || '(untitled event)',
          path: '',
          kind: 'ics',
          course: source,
        })
      }
      cur = null
      continue
    }
    if (!cur) continue
    const p = prop(line)
    if (!p) continue
    if (p.name === 'SUMMARY') cur.title = unescape(p.value)
    else if (p.name === 'DTSTART') cur.date = toIsoDate(p.value) ?? cur.date
  }
  return events
}
