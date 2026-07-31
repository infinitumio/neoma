// SPDX-License-Identifier: AGPL-3.0-or-later
/** Small date-formatting helpers (no external date library). */

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Format a date with a Moment-style subset of tokens:
 * YYYY, MM, DD, MMMM, MMM, dddd, ddd, HH, mm, ss
 */
export function formatDate(date: Date, format: string): string {
  return format.replace(/YYYY|MMMM|MMM|MM|DD|dddd|ddd|HH|mm|ss/g, (token) => {
    switch (token) {
      case 'YYYY':
        return String(date.getFullYear())
      case 'MMMM':
        return MONTHS[date.getMonth()]
      case 'MMM':
        return MONTHS[date.getMonth()].slice(0, 3)
      case 'MM':
        return pad(date.getMonth() + 1)
      case 'DD':
        return pad(date.getDate())
      case 'dddd':
        return DAYS[date.getDay()]
      case 'ddd':
        return DAYS[date.getDay()].slice(0, 3)
      case 'HH':
        return pad(date.getHours())
      case 'mm':
        return pad(date.getMinutes())
      case 'ss':
        return pad(date.getSeconds())
      default:
        return token
    }
  })
}

/** ISO date (YYYY-MM-DD) in local time. */
export function isoDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Parse a date string produced by `formatDate` with the same format. */
export function parseDate(value: string, format: string): Date | null {
  // Build a regex from the format, capturing YYYY/MM/DD.
  const pattern = format
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace('YYYY', '(?<y>\\d{4})')
    .replace('MM', '(?<m>\\d{2})')
    .replace('DD', '(?<d>\\d{2})')
  const match = new RegExp(`^${pattern}$`).exec(value)
  if (!match?.groups?.y || !match.groups.m || !match.groups.d) return null
  const date = new Date(Number(match.groups.y), Number(match.groups.m) - 1, Number(match.groups.d))
  return isNaN(date.getTime()) ? null : date
}

export function friendlyDateTime(timestamp: number): string {
  const d = new Date(timestamp)
  return `${formatDate(d, 'DD MMM YYYY')} at ${formatDate(d, 'HH:mm')}`
}
