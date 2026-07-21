// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Floating formatting toolbar shown above the current editor selection.
 * Lets the user re-format highlighted text in place — bold, italic,
 * strikethrough, inline code, wiki link — and apply coloured highlights
 * from a small palette (stored as portable `==…==` / `<mark data-color>`
 * syntax, see docs/markdown-compatibility.md).
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Bold, Italic, Strikethrough, Highlighter, Code, Link2, X } from 'lucide-react'
import type { EditorView } from '@codemirror/view'
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleCode,
  insertWikiLink,
  applyHighlight,
  HIGHLIGHT_COLORS,
  type HighlightColor,
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
  { label: 'Inline code', icon: Code, run: toggleCode },
  { label: 'Wiki link', icon: Link2, run: insertWikiLink },
]

export function SelectionToolbar({ view, position, onAfterCommand }: SelectionToolbarProps) {
  const [showColors, setShowColors] = useState(false)

  const apply = (fn: (view: EditorView) => boolean) => {
    fn(view)
    setShowColors(false)
    onAfterCommand()
  }

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
          onClick={() => apply(action.run)}
        >
          <action.icon size={15} aria-hidden />
        </button>
      ))}
      <button
        className="selection-toolbar-btn"
        aria-label="Highlight colour"
        aria-expanded={showColors}
        title="Highlight"
        onClick={() => setShowColors((s) => !s)}
      >
        <Highlighter size={15} aria-hidden />
      </button>
      {showColors && (
        <div className="highlight-palette" role="group" aria-label="Highlight colours">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              className="highlight-swatch"
              style={{ background: `var(--hl-${color})` }}
              aria-label={`Highlight ${color}`}
              title={color}
              onClick={() => apply((v) => applyHighlight(v, color as HighlightColor))}
            />
          ))}
          <button
            className="highlight-swatch highlight-clear"
            aria-label="Remove highlight"
            title="Remove highlight"
            onClick={() => apply((v) => applyHighlight(v, null))}
          >
            <X size={11} aria-hidden />
          </button>
        </div>
      )}
    </div>,
    document.body,
  )
}
