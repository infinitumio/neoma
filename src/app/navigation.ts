// SPDX-License-Identifier: AGPL-3.0-or-later
/** Shared navigation helpers used by preview links, panels and commands. */
import { getLinkGraph, createNote, useVault } from './vaultStore'
import { useTabs } from './tabsStore'
import { useUi } from './uiStore'
import { basename, dirname } from '@/utils/paths'

/**
 * Open a wiki-link target. If it does not resolve, offer to create the note
 * (never create silently).
 */
export async function openNoteByTarget(target: string, heading?: string): Promise<void> {
  const graph = getLinkGraph()
  const resolved = useVault.getState().metas.has(target) ? target : graph.resolve(target)
  if (resolved) {
    useTabs.getState().openNote(resolved)
    if (heading) scrollToHeading(resolved, heading)
    return
  }
  useUi.getState().askConfirm({
    title: 'Create note?',
    message: `"${target}" does not exist yet. Create it?`,
    confirmLabel: 'Create note',
    onConfirm: async () => {
      const path = await createNote(dirname(target), basename(target))
      if (path) useTabs.getState().openNote(path)
    },
  })
}

/** Ask the reading view / editor to scroll to a heading slug or text. */
export function scrollToHeading(path: string, heading: string): void {
  // Give the note a moment to open before dispatching.
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('neoma:scroll-to-heading', { detail: { path, heading } }))
  }, 120)
}
