// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Segmented control for the note view mode: Edit, Split, Reading and the
 * read-only Markdown Source view. Makes every mode discoverable without the
 * command palette.
 */
import { Pencil, Columns2, BookOpen, FileCode } from 'lucide-react'
import type { EditorMode } from '@/types'
import { useUi } from '@/app/uiStore'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useSettings } from '@/settings/settingsStore'

const MODES: Array<{ id: EditorMode; label: string; icon: typeof Pencil }> = [
  { id: 'edit', label: 'Edit', icon: Pencil },
  { id: 'split', label: 'Split', icon: Columns2 },
  { id: 'reading', label: 'Reading', icon: BookOpen },
  { id: 'source', label: 'Source', icon: FileCode },
]

export function ViewModeSwitcher() {
  const editorMode = useUi((s) => s.editorMode)
  const setEditorMode = useUi((s) => s.setEditorMode)
  const isMobile = useIsMobile()
  const showSource = useSettings((s) => s.settings.showSourceView)
  // Split doesn't fit a phone; Source is opt-in (Settings → Editor).
  const modes = MODES.filter(
    (m) => (m.id !== 'split' || !isMobile) && (m.id !== 'source' || showSource),
  )

  return (
    <div className="view-switcher" role="group" aria-label="View mode">
      {modes.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={`view-switcher-btn${editorMode === id ? ' active' : ''}`}
          aria-pressed={editorMode === id}
          title={`${label} view`}
          onClick={() => setEditorMode(id)}
        >
          <Icon size={14} aria-hidden />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
