// SPDX-License-Identifier: AGPL-3.0-or-later
/** Detect the editor context at the cursor to prioritise relevant commands. */
import type { EditorView } from '@codemirror/view'
import type { EditorContext } from './types'

/**
 * Determine what kind of block the cursor is in. Uses a lightweight textual
 * scan (no full AST) so it stays fast on every keystroke.
 */
export function detectContext(view: EditorView): EditorContext {
  const { state } = view
  const pos = state.selection.main.head
  const line = state.doc.lineAt(pos)
  const text = line.text
  const before = state.doc.sliceString(Math.max(0, pos - 4000), pos)

  // Fenced code block: odd number of ``` fences before the cursor.
  const fences = (before.match(/^```/gm) || []).length
  if (fences % 2 === 1) return 'code'

  // Display math: odd number of $$ before the cursor (and not in code).
  const displayMath = (before.match(/\$\$/g) || []).length
  if (displayMath % 2 === 1) return 'math'
  // Inline math on the current line: unbalanced single $ before the cursor.
  const inlineDollars = (line.text.slice(0, pos - line.from).match(/(?<!\$)\$(?!\$)/g) || []).length
  if (inlineDollars % 2 === 1) return 'math'

  if (/^\s{0,6}#{1,6}\s/.test(text)) return 'heading'
  if (/^\s*([-*+]|\d+\.)\s/.test(text)) return 'list'
  if (/^\s*>/.test(text)) return 'quote'
  if (/^\s*\|/.test(text) || / \| /.test(text)) return 'table'
  return null
}
