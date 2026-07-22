// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Create a calendar event: a small `type: event` page stored under `Calendar/`
 * with the date in its name so events group by day. Shared by the mini
 * calendar (quick add) and the full calendar's day summary.
 */
import { createNote } from '@/app/vaultStore'
import { useUi } from '@/app/uiStore'
import { useTabs } from '@/app/tabsStore'

/** Prompt for a title and create an event on `date` (ISO). */
export function promptNewEvent(date: string, open = true): void {
  useUi.getState().askPrompt({
    title: 'New event',
    label: `Event on ${date}`,
    placeholder: 'e.g. Study group',
    confirmLabel: 'Create',
    onSubmit: async (value) => {
      const name = value.trim()
      if (!name) return
      const content = `---\ntitle: ${name}\ntype: event\ndate: ${date}\ntags:\n  - event\n---\n\n`
      const path = await createNote('Calendar', `${date} ${name}`, content)
      if (path) {
        if (open) useTabs.getState().openNote(path)
        useUi.getState().toast('Event added', 'success')
      }
    },
  })
}
