// SPDX-License-Identifier: AGPL-3.0-or-later
/** File-tree building, incl. PDF-as-parent nesting for companion notes. */
import { describe, expect, it } from 'vitest'
import { buildTree } from '@/components/FileTree'
import type { FileEntry } from '@/types'

function entries(paths: Array<[string, FileEntry['kind']]>): Map<string, FileEntry> {
  const m = new Map<string, FileEntry>()
  for (const [path, kind] of paths) m.set(path, { path, kind, size: 0, modifiedAt: 0 })
  return m
}

describe('buildTree PDF nesting', () => {
  it('nests a same-name sibling folder under the PDF', () => {
    const tree = buildTree(
      entries([
        ['Week 1', 'folder'],
        ['Week 1/lecture.pdf', 'file'],
        ['Week 1/lecture', 'folder'],
        ['Week 1/lecture/lecture — notes.md', 'file'],
      ]),
      'name',
    )
    const week = tree.find((n) => n.entry.path === 'Week 1')!
    // The `lecture/` folder is gone from the sibling list …
    expect(week.children.some((n) => n.entry.path === 'Week 1/lecture')).toBe(false)
    // … and the PDF now owns the note.
    const pdf = week.children.find((n) => n.entry.path === 'Week 1/lecture.pdf')!
    expect(pdf.children.map((n) => n.entry.path)).toEqual(['Week 1/lecture/lecture — notes.md'])
  })

  it('leaves a PDF without a matching folder as a plain leaf', () => {
    const tree = buildTree(entries([['a.pdf', 'file']]), 'name')
    const pdf = tree.find((n) => n.entry.path === 'a.pdf')!
    expect(pdf.children).toHaveLength(0)
  })

  it('applies a manual folder order, appending unranked items after', () => {
    const tree = buildTree(
      entries([
        ['a.md', 'file'],
        ['b.md', 'file'],
        ['c.md', 'file'],
      ]),
      'name',
      { '': ['c.md', 'a.md'] },
    )
    // c, a are ranked (in that order); b is unranked → after.
    expect(tree.map((n) => n.entry.path)).toEqual(['c.md', 'a.md', 'b.md'])
  })

  it('does not nest a folder that only shares a prefix with the PDF', () => {
    const tree = buildTree(
      entries([
        ['lecture.pdf', 'file'],
        ['lecture-notes', 'folder'],
        ['lecture-notes/x.md', 'file'],
      ]),
      'name',
    )
    // Different name → stays a separate top-level folder.
    expect(tree.some((n) => n.entry.path === 'lecture-notes')).toBe(true)
    expect(tree.find((n) => n.entry.path === 'lecture.pdf')!.children).toHaveLength(0)
  })
})
