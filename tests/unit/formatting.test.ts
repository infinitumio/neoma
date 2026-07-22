// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Formatting regression tests, added after user feedback that italics broke.
 * Covers rendering of every inline style plus the emphasis-toggle logic that
 * previously destroyed bold when italic was applied on top of it.
 */
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/markdown/render'
import {
  computeEmphasisToggle,
  computeSymmetricToggle,
  computeHighlight,
} from '@/editor/markdownCommands'

function applyEdit(
  doc: string,
  result: { changes: Array<{ from: number; to: number; insert: string }> },
): string {
  const edits = [...result.changes].sort((a, b) => b.from - a.from)
  let out = doc
  for (const e of edits) out = out.slice(0, e.from) + e.insert + out.slice(e.to)
  return out
}

describe('inline markdown rendering', () => {
  it('renders italic with * and _', async () => {
    expect(await renderMarkdown('*it*')).toContain('<em>it</em>')
    expect(await renderMarkdown('_it_')).toContain('<em>it</em>')
  })
  it('renders bold', async () => {
    expect(await renderMarkdown('**b**')).toContain('<strong>b</strong>')
  })
  it('renders bold italic', async () => {
    const html = await renderMarkdown('***both***')
    expect(html).toContain('<em>')
    expect(html).toContain('<strong>')
  })
  it('renders italic nested inside bold', async () => {
    const html = await renderMarkdown('**bold *nested* bold**')
    expect(html).toContain('<em>nested</em>')
  })
  it('renders strikethrough, highlight, inline code', async () => {
    const html = await renderMarkdown('~~gone~~ ==hi== `code`')
    expect(html).toContain('<del>gone</del>')
    expect(html).toContain('<mark>hi</mark>')
    expect(html).toContain('<code>code</code>')
  })
})

describe('emphasis toggle (italic width 1, bold width 2)', () => {
  it('adds italic to a plain selection', () => {
    const r = computeEmphasisToggle('hello world', 0, 5, 1)
    expect(applyEdit('hello world', r)).toBe('*hello* world')
  })
  it('removes italic from an italic selection', () => {
    const r = computeEmphasisToggle('*hello* world', 1, 6, 1)
    expect(applyEdit('*hello* world', r)).toBe('hello world')
  })
  it('adds italic on bold text without destroying bold', () => {
    const r = computeEmphasisToggle('**word**', 2, 6, 1)
    expect(applyEdit('**word**', r)).toBe('***word***')
  })
  it('removes only italic from bold-italic', () => {
    const r = computeEmphasisToggle('***word***', 3, 7, 1)
    expect(applyEdit('***word***', r)).toBe('**word**')
  })
  it('adds bold on italic text producing bold-italic', () => {
    const r = computeEmphasisToggle('*word*', 1, 5, 2)
    expect(applyEdit('*word*', r)).toBe('***word***')
  })
  it('removes only bold from bold-italic', () => {
    const r = computeEmphasisToggle('***word***', 3, 7, 2)
    expect(applyEdit('***word***', r)).toBe('*word*')
  })
  it('handles a selection that includes the markers', () => {
    const r = computeEmphasisToggle('**word**', 0, 8, 2)
    expect(applyEdit('**word**', r)).toBe('word')
  })
  it('inserts an empty pair at a bare cursor', () => {
    const r = computeEmphasisToggle('text ', 5, 5, 1)
    expect(applyEdit('text ', r)).toBe('text **')
    expect(r.rangeFrom).toBe(6)
  })
})

describe('symmetric marker toggles', () => {
  it('toggles strikethrough on and off', () => {
    const on = applyEdit('word', computeSymmetricToggle('word', 0, 4, '~~'))
    expect(on).toBe('~~word~~')
    const off = applyEdit(on, computeSymmetricToggle(on, 2, 6, '~~'))
    expect(off).toBe('word')
  })
  it('strips markers included in the selection', () => {
    const r = computeSymmetricToggle('==word==', 0, 8, '==')
    expect(applyEdit('==word==', r)).toBe('word')
  })
})

describe('coloured highlights', () => {
  it('applies the portable == syntax for yellow', () => {
    const r = computeHighlight('important', 0, 9, 'yellow')
    expect(applyEdit('important', r)).toBe('==important==')
  })
  it('applies mark tags for other colours', () => {
    const r = computeHighlight('definition', 0, 10, 'blue')
    expect(applyEdit('definition', r)).toBe('<mark data-color="blue">definition</mark>')
  })
  it('switches colour by replacing the existing wrapper', () => {
    const doc = '<mark data-color="blue">word</mark>'
    const r = computeHighlight(doc, 24, 28, 'green')
    expect(applyEdit(doc, r)).toBe('<mark data-color="green">word</mark>')
  })
  it('clears a highlight with color null', () => {
    const doc = '==word=='
    const r = computeHighlight(doc, 2, 6, null)
    expect(applyEdit(doc, r)).toBe('word')
  })
  it('renders coloured marks in the preview', async () => {
    const html = await renderMarkdown('<mark data-color="blue">definition</mark>')
    expect(html).toContain('mark-blue')
    expect(html).toContain('definition')
  })
  it('rejects unknown colours (treated as plain text, not HTML)', async () => {
    const html = await renderMarkdown('<mark data-color="evil" onclick="x()">t</mark>')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('<mark')
  })
})
