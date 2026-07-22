// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Daily notes: configurable folder, date format and default template.
 * Notes are only created after explicit user confirmation or an explicit
 * "open today's note" command — never silently.
 */
import { formatDate, isoDate, parseDate } from '@/utils/dates'
import { joinPath } from '@/utils/paths'
import { useSettings } from '@/settings/settingsStore'
import { createNote, useVault } from '@/app/vaultStore'
import { getTemplateContent, expandTemplate } from './service'

/** The `Calendar/<date>` folder that holds a day's journal note and events. */
export function calendarDayFolder(date: Date): string {
  const { dailyNotesFolder, dailyNoteFormat } = useSettings.getState().settings
  return joinPath(dailyNotesFolder, formatDate(date, dailyNoteFormat))
}

export function dailyNotePath(date: Date): string {
  const name = formatDate(date, useSettings.getState().settings.dailyNoteFormat)
  // The journal note is the folder-note of its day folder, so the day's events
  // nest under it: e.g. Calendar/2026-07-25/2026-07-25.md.
  return joinPath(calendarDayFolder(date), `${name}.md`)
}

export function dailyNoteExists(date: Date): boolean {
  return useVault.getState().entries.has(dailyNotePath(date))
}

/** The date a daily-note path represents, or null if it is not one. */
export function dateOfDailyNote(path: string): Date | null {
  const { dailyNotesFolder, dailyNoteFormat } = useSettings.getState().settings
  const prefix = dailyNotesFolder ? dailyNotesFolder + '/' : ''
  if (!path.startsWith(prefix) || !path.endsWith('.md')) return null
  // Path is `<folder>/<date>/<date>.md` — the date is the day-folder segment.
  const rest = path.slice(prefix.length, -3) // e.g. "2026-07-25/2026-07-25"
  const dayName = rest.split('/')[0]
  return parseDate(dayName, dailyNoteFormat)
}

/**
 * Create the daily note for `date` (caller has already confirmed creation).
 * Returns the created path.
 */
export async function createDailyNote(date: Date): Promise<string | null> {
  const settings = useSettings.getState().settings
  const title = formatDate(date, settings.dailyNoteFormat)
  let content = `---\ntitle: ${title}\ncreated: ${isoDate(date)}\ntype: journal\n---\n\n`
  if (settings.dailyNoteTemplateId) {
    const template = await getTemplateContent(settings.dailyNoteTemplateId)
    if (template) content = expandTemplate(template, title, date)
  }
  // The journal note is the folder-note of Calendar/<date>/, so events for the
  // day nest under it.
  return createNote(calendarDayFolder(date), title, content)
}
