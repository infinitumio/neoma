// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Floating formatting toolbar shown above the current editor selection. It
 * lets the user re-format highlighted text in place (bold, italic,
 * strikethrough, highlight, inline code) or wrap it in a wiki link — without
 * leaving the keyboard flow or hunting for a menu.
 */
import { createPortal } from 'react-dom'
import { Bold, Italic, Strikethrough, Highlighter, Code, Link2 } from 'lucide-react'
import type { EditorView } from '@codemirror/view'
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleHighlight,
  toggleCode,
  insertWikiLink,
} from '@/editor/markdownCommands'

export interface ToolbarPosition {
  top: number
  left: number
}

interface SelectionToolbarProps {
  view: EditorView
  position: ToolbarPosition
  /** Recompute position after a command changes the selection. */
  onAfterCommand: () => void
}

interface Action {
  label: string
  icon: typeof Bold
  run: (view: EditorView) => boolean
}

const ACTIONS: Action[] = [
  { label: 'Bold', icon: Bold, run: toggleBold },
  { label: 'Italic', icon: Italic, run: toggleItalic },
  { label: 'Strikethrough', icon: Strikethrough, run: toggleStrikethrough },
  { label: 'Highlight', icon: Highlighter, run: toggleHighlight },
  { label: 'Inline code', icon: Code, run: toggleCode },
  { label: 'Wiki link', icon: Link2, run: insertWikiLink },
]

export function SelectionToolbar({ view, position, onAfterCommand }: SelectionToolbarProps) {
  return createPortal(
    <div
      className="selection-toolbar"
      role="toolbar"
      aria-label="Format selection"
      style={{ top: position.top, left: position.left }}
      // Keep the editor selection intact when interacting with the toolbar.
      onMouseDown={(e) => e.preventDefault()}
    >
      {ACTIONS.map((action) => (
        <button
          key={action.label}
          className="selection-toolbar-btn"
          aria-label={action.label}
          title={action.label}
          onClick={() => {
            action.run(view)
            onAfterCommand()
          }}
        >
          <action.icon size={15} aria-hidden />
        </button>
      ))}
    </div>,
    document.body,
  )
}
