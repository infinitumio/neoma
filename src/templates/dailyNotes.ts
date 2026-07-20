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

export function dailyNotePath(date: Date): string {
  const { dailyNotesFolder, dailyNoteFormat } = useSettings.getState().settings
  return joinPath(dailyNotesFolder, `${formatDate(date, dailyNoteFormat)}.md`)
}

export function dailyNoteExists(date: Date): boolean {
  return useVault.getState().entries.has(dailyNotePath(date))
}

/** The date a daily-note path represents, or null if it is not one. */
export function dateOfDailyNote(path: string): Date | null {
  const { dailyNotesFolder, dailyNoteFormat } = useSettings.getState().settings
  const prefix = dailyNotesFolder ? dailyNotesFolder + '/' : ''
  if (!path.startsWith(prefix) || !path.endsWith('.md')) return null
  const name = path.slice(prefix.length, -3)
  return parseDate(name, dailyNoteFormat)
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
  return createNote(settings.dailyNotesFolder, title, content)
}
