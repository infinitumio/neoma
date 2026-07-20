// SPDX-License-Identifier: AGPL-3.0-or-later
/** Editor commands for markdown formatting (bold, italic, links…). */
import type { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

/** Toggle a symmetric inline marker (e.g. ** or ==) around each selection. */
export function toggleInline(view: EditorView, marker: string): boolean {
  const changes = view.state.changeByRange((range) => {
    const from = range.from
    const to = range.to
    const before = view.state.sliceDoc(Math.max(0, from - marker.length), from)
    const after = view.state.sliceDoc(to, to + marker.length)
    if (before === marker && after === marker) {
      return {
        changes: [
          { from: from - marker.length, to: from, insert: '' },
          { from: to, to: to + marker.length, insert: '' },
        ],
        range: EditorSelection.range(from - marker.length, to - marker.length),
      }
    }
    const selected = view.state.sliceDoc(from, to)
    if (
      selected.startsWith(marker) &&
      selected.endsWith(marker) &&
      selected.length >= marker.length * 2
    ) {
      return {
        changes: { from, to, insert: selected.slice(marker.length, -marker.length) },
        range: EditorSelection.range(from, to - marker.length * 2),
      }
    }
    return {
      changes: [
        { from, insert: marker },
        { from: to, insert: marker },
      ],
      range: EditorSelection.range(from + marker.length, to + marker.length),
    }
  })
  view.dispatch(changes, { scrollIntoView: true, userEvent: 'input' })
  view.focus()
  return true
}

export const toggleBold = (view: EditorView) => toggleInline(view, '**')
export const toggleItalic = (view: EditorView) => toggleInline(view, '*')
export const toggleStrikethrough = (view: EditorView) => toggleInline(view, '~~')
export const toggleHighlight = (view: EditorView) => toggleInline(view, '==')
export const toggleCode = (view: EditorView) => toggleInline(view, '`')

/** Insert a wiki link around the selection (cursor lands inside). */
export function insertWikiLink(view: EditorView): boolean {
  const changes = view.state.changeByRange((range) => {
    const selected = view.state.sliceDoc(range.from, range.to)
    return {
      changes: { from: range.from, to: range.to, insert: `[[${selected}]]` },
      range: selected
        ? EditorSelection.range(range.from + 2, range.to + 2)
        : EditorSelection.cursor(range.from + 2),
    }
  })
  view.dispatch(changes, { scrollIntoView: true, userEvent: 'input' })
  view.focus()
  return true
}

/** Insert a markdown link `[text](url)` around the selection. */
export function insertMarkdownLink(view: EditorView): boolean {
  const changes = view.state.changeByRange((range) => {
    const selected = view.state.sliceDoc(range.from, range.to)
    const insert = `[${selected}]()`
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + insert.length - 1),
    }
  })
  view.dispatch(changes, { scrollIntoView: true, userEvent: 'input' })
  view.focus()
  return true
}
