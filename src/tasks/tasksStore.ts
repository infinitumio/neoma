// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Collect tasks across the vault and toggle them, writing the change back to
 * the Markdown source. All offline; tasks remain plain Markdown checkboxes.
 */
import { getAdapter, loadNote, updateNoteContent, useVault } from '@/app/vaultStore'
import { isMarkdown } from '@/utils/paths'
import { parseTasks, toggleTaskAtLine, type Task } from './tasks'

/** Every task in every Markdown note in the vault. */
export async function tasksForVault(): Promise<Task[]> {
  const adapter = getAdapter()
  if (!adapter) return []
  const notes = useVault.getState().notes
  const paths = [...useVault.getState().entries.values()]
    .filter((e) => e.kind === 'file' && isMarkdown(e.path))
    .map((e) => e.path)
  const all: Task[] = []
  for (const path of paths) {
    try {
      const text = notes.get(path)?.content ?? (await adapter.readText(path))
      all.push(...parseTasks(path, text))
    } catch {
      /* skip unreadable notes */
    }
  }
  return all
}

/** Toggle a task's checkbox and persist it to the note. */
export async function toggleTask(task: Task): Promise<void> {
  await loadNote(task.path)
  const content = useVault.getState().notes.get(task.path)?.content
  if (content == null) return
  const next = toggleTaskAtLine(content, task.line)
  if (next !== content) updateNoteContent(task.path, next)
}
