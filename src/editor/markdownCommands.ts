// SPDX-License-Identifier: AGPL-3.0-or-later
/** Editor commands for markdown formatting (bold, italic, links…). */
import type { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

export interface InlineToggleResult {
  changes: Array<{ from: number; to: number; insert: string }>
  /** selection after the edit, in post-edit coordinates */
  rangeFrom: number
  rangeTo: number
}

/**
 * Compute the edit for toggling `*`-based emphasis of a given width around
 * [from, to] in `doc`. Width 1 = italic, width 2 = bold.
 *
 * Emphasis markers share one character, so naive marker matching breaks
 * combinations: toggling italic on `**bold**` must yield `***both***`, not
 * strip the bold. This counts the run of `*` on each side instead:
 *   run % 2 === 1  → italic present (1 or 3 stars)
 *   run >= 2       → bold present   (2 or 3 stars)
 */
export function computeEmphasisToggle(
  doc: string,
  from: number,
  to: number,
  width: 1 | 2,
): InlineToggleResult {
  const marker = '*'.repeat(width)

  // If the user selected the markers themselves (`**word**`), trim the
  // selection to the inner text so the run-counting below sees the stars.
  let innerFrom = from
  let innerTo = to
  while (innerFrom < innerTo && doc[innerFrom] === '*') innerFrom++
  while (innerTo > innerFrom && doc[innerTo - 1] === '*') innerTo--

  // Runs of '*' immediately around the (trimmed) selection, capped at 3.
  let before = 0
  while (before < 3 && innerFrom - before - 1 >= 0 && doc[innerFrom - before - 1] === '*') before++
  let after = 0
  while (after < 3 && innerTo + after < doc.length && doc[innerTo + after] === '*') after++

  const italicActive = before % 2 === 1 && after % 2 === 1
  const boldActive = before >= 2 && after >= 2
  const active = width === 1 ? italicActive : boldActive

  if (active) {
    // Remove `width` stars from each side, adjacent to the text.
    const changes = [
      { from: innerFrom - width, to: innerFrom, insert: '' },
      { from: innerTo, to: innerTo + width, insert: '' },
    ]
    return { changes, rangeFrom: innerFrom - width, rangeTo: innerTo - width }
  }

  if (innerFrom === innerTo && from === to) {
    // No selection: insert an empty pair and put the caret inside.
    return {
      changes: [{ from, to, insert: marker + marker }],
      rangeFrom: from + width,
      rangeTo: from + width,
    }
  }

  const changes = [
    { from: innerFrom, to: innerFrom, insert: marker },
    { from: innerTo, to: innerTo, insert: marker },
  ]
  return { changes, rangeFrom: innerFrom + width, rangeTo: innerTo + width }
}

/**
 * Compute the edit for toggling a symmetric non-`*` marker (~~, ==, `)
 * around [from, to].
 */
export function computeSymmetricToggle(
  doc: string,
  from: number,
  to: number,
  marker: string,
): InlineToggleResult {
  const len = marker.length
  const selected = doc.slice(from, to)

  // Selection includes the markers: strip them from the selection edges.
  if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= len * 2) {
    return {
      changes: [
        { from, to: from + len, insert: '' },
        { from: to - len, to, insert: '' },
      ],
      rangeFrom: from,
      rangeTo: to - len * 2,
    }
  }
  // Markers just outside the selection.
  if (doc.slice(Math.max(0, from - len), from) === marker && doc.slice(to, to + len) === marker) {
    return {
      changes: [
        { from: from - len, to: from, insert: '' },
        { from: to, to: to + len, insert: '' },
      ],
      rangeFrom: from - len,
      rangeTo: to - len,
    }
  }
  return {
    changes: [
      { from, to: from, insert: marker },
      { from: to, to, insert: marker },
    ],
    rangeFrom: from + len,
    rangeTo: to + len,
  }
}

function applyToggle(
  view: EditorView,
  compute: (doc: string, from: number, to: number) => InlineToggleResult,
): boolean {
  const doc = view.state.doc.toString()
  const changes = view.state.changeByRange((range) => {
    const result = compute(doc, range.from, range.to)
    return {
      changes: result.changes,
      range: EditorSelection.range(result.rangeFrom, result.rangeTo),
    }
  })
  view.dispatch(changes, { scrollIntoView: true, userEvent: 'input' })
  view.focus()
  return true
}

export const toggleBold = (view: EditorView) =>
  applyToggle(view, (d, f, t) => computeEmphasisToggle(d, f, t, 2))
export const toggleItalic = (view: EditorView) =>
  applyToggle(view, (d, f, t) => computeEmphasisToggle(d, f, t, 1))
export const toggleStrikethrough = (view: EditorView) =>
  applyToggle(view, (d, f, t) => computeSymmetricToggle(d, f, t, '~~'))
export const toggleHighlight = (view: EditorView) =>
  applyToggle(view, (d, f, t) => computeSymmetricToggle(d, f, t, '=='))
export const toggleCode = (view: EditorView) =>
  applyToggle(view, (d, f, t) => computeSymmetricToggle(d, f, t, '`'))

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

/** Insert text at the cursor (used by the symbol menu and slash commands). */
export function insertAtCursor(view: EditorView, text: string, cursorOffset?: number): boolean {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + (cursorOffset ?? text.length) },
    scrollIntoView: true,
    userEvent: 'input',
  })
  view.focus()
  return true
}

/* ---- Coloured highlights ---------------------------------------------- */

export const HIGHLIGHT_COLORS = [
  'yellow',
  'green',
  'blue',
  'purple',
  'red',
  'orange',
  'grey',
] as const
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

const MARK_OPEN_RE = /<mark data-color="(yellow|green|blue|purple|red|orange|grey)">$/
const MARK_CLOSE_RE = /^<\/mark>/

/**
 * Compute the edit for applying (or clearing, with color === null) a
 * highlight over [from, to]. Yellow uses the portable `==text==` syntax;
 * other colours use the documented `<mark data-color="…">` extension so the
 * file stays readable outside neoma.
 */
export function computeHighlight(
  doc: string,
  from: number,
  to: number,
  color: HighlightColor | null,
): InlineToggleResult {
  // Detect an existing highlight wrapping the selection and strip it first.
  const beforeText = doc.slice(Math.max(0, from - 40), from)
  const afterText = doc.slice(to, to + 10)
  const openMatch = MARK_OPEN_RE.exec(beforeText)
  const strip: Array<{ from: number; to: number; insert: string }> = []
  let removedBefore = 0

  if (openMatch && MARK_CLOSE_RE.test(afterText)) {
    strip.push({ from: from - openMatch[0].length, to: from, insert: '' })
    strip.push({ from: to, to: to + 7, insert: '' })
    removedBefore = openMatch[0].length
  } else if (doc.slice(Math.max(0, from - 2), from) === '==' && doc.slice(to, to + 2) === '==') {
    strip.push({ from: from - 2, to: from, insert: '' })
    strip.push({ from: to, to: to + 2, insert: '' })
    removedBefore = 2
  }

  if (color === null) {
    if (!strip.length) return { changes: [], rangeFrom: from, rangeTo: to }
    return { changes: strip, rangeFrom: from - removedBefore, rangeTo: to - removedBefore }
  }

  const open = color === 'yellow' ? '==' : `<mark data-color="${color}">`
  const close = color === 'yellow' ? '==' : '</mark>'
  const newFrom = from - removedBefore
  const newTo = to - removedBefore
  return {
    changes: [...strip, { from, to: from, insert: open }, { from: to, to, insert: close }],
    rangeFrom: newFrom + open.length,
    rangeTo: newTo + open.length,
  }
}

export function applyHighlight(view: EditorView, color: HighlightColor | null): boolean {
  return applyToggle(view, (d, f, t) => computeHighlight(d, f, t, color))
}
