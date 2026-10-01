// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Formatting bar docked above the keyboard while the editor is focused on a
 * phone.
 *
 * The floating selection toolbar is desktop-only: on a phone iOS puts its own
 * Cut/Copy/Paste callout over the selection, and two overlapping bars fight for
 * the same few points. That left the phone with no way to apply bold, italic or
 * strikethrough at all.
 *
 * iOS *can* be persuaded to add items to its own callout, but only through
 * UIMenuController.menuItems, deprecated since iOS 16, reached by swizzling a
 * private WebKit view. A bar above the keyboard is what Bear, iA Writer and
 * Obsidian all do instead: it needs no native code, works whether or not there
 * is a selection, and does not depend on an API Apple is retiring.
 *
 * Carries the same actions as the desktop SelectionToolbar, highlight palette
 * included, so neither platform can do something the other cannot. The row
 * scrolls sideways rather than shrinking its targets — a 44pt tap area matters
 * more here than seeing every action at once.
 */
import { useState } from 'react'
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

interface Action {
  label: string
  icon: typeof Bold
  run: (view: EditorView, range: { from: number; to: number }) => boolean
}

const ACTIONS: Action[] = [
  { label: 'Bold', icon: Bold, run: toggleBold },
  { label: 'Italic', icon: Italic, run: toggleItalic },
  { label: 'Strikethrough', icon: Strikethrough, run: toggleStrikethrough },
  { label: 'Inline code', icon: Code, run: toggleCode },
  { label: 'Wiki link', icon: Link2, run: insertWikiLink },
]

export function EditorFormatBar({ view, bottom }: { view: EditorView; bottom: number }) {
  const [showColors, setShowColors] = useState(false)

  const apply = (run: (view: EditorView, range: { from: number; to: number }) => boolean) => {
    // Read the selection at tap time rather than capturing it earlier: unlike
    // the desktop toolbar this bar is always on screen, so the selection moves
    // underneath it.
    const { from, to } = view.state.selection.main
    run(view, { from, to })
    setShowColors(false)
    view.focus()
  }

  return (
    <div
      className="format-bar"
      style={{ bottom }}
      // Never let a tap move focus: blurring the editor dismisses the keyboard,
      // which would close the very bar being tapped.
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
    >
      {showColors && (
        <div className="format-bar-colors" role="group" aria-label="Highlight colours">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="format-bar-swatch"
              style={{ background: `var(--hl-${color})` }}
              aria-label={`Highlight ${color}`}
              title={color}
              onClick={() => apply((v, r) => applyHighlight(v, color as HighlightColor, r))}
            />
          ))}
          <button
            type="button"
            className="format-bar-swatch format-bar-swatch-clear"
            aria-label="Remove highlight"
            title="Remove highlight"
            onClick={() => apply((v, r) => applyHighlight(v, null, r))}
          >
            <X size={13} aria-hidden />
          </button>
        </div>
      )}

      <div className="format-bar-row" role="toolbar" aria-label="Format text">
        {ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            className="format-bar-btn"
            aria-label={action.label}
            title={action.label}
            onClick={() => apply(action.run)}
          >
            <action.icon size={19} aria-hidden />
          </button>
        ))}
        <button
          type="button"
          className={`format-bar-btn${showColors ? ' active' : ''}`}
          aria-label="Highlight colour"
          aria-expanded={showColors}
          title="Highlight"
          onClick={() => setShowColors((s) => !s)}
        >
          <Highlighter size={19} aria-hidden />
        </button>
      </div>
    </div>
  )
}
