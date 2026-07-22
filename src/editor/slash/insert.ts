// SPDX-License-Identifier: AGPL-3.0-or-later
/** Insertion helpers shared by slash commands. */
import { snippet } from '@codemirror/autocomplete'
import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

/**
 * Insert a snippet template at the cursor. Uses CodeMirror's `${}` field
 * syntax so the caret lands in the first placeholder and Tab moves between
 * fields. Ensures block templates start on a fresh line.
 */
export function insertSnippet(view: EditorView, template: string): void {
  const { from, to } = view.state.selection.main
  const lineStart = view.state.doc.lineAt(from)
  const atLineStart = from === lineStart.from
  const isBlock = /\n/.test(template) || /^(#{1,6} |[-*+] |\d+\. |> |```|\| |---)/.test(template)
  const prefix = isBlock && !atLineStart ? '\n' : ''
  snippet(prefix + template)(view, null, from, to)
  view.focus()
}

/** Wrap the current selection (or insert a placeholder) with inline markers. */
export function wrapSelection(
  view: EditorView,
  before: string,
  after: string,
  placeholder = 'text',
): void {
  const range = view.state.selection.main
  const selected = view.state.sliceDoc(range.from, range.to) || placeholder
  const insert = `${before}${selected}${after}`
  view.dispatch({
    changes: { from: range.from, to: range.to, insert },
    selection: EditorSelection.range(
      range.from + before.length,
      range.from + before.length + selected.length,
    ),
    userEvent: 'input',
  })
  view.focus()
}

/** Insert plain text at the cursor, optionally placing the caret at `cursor`. */
export function insertText(view: EditorView, text: string, cursor?: number): void {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + (cursor ?? text.length) },
    userEvent: 'input',
  })
  view.focus()
}
