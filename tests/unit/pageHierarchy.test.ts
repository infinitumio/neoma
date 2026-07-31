// SPDX-License-Identifier: AGPL-3.0-or-later
/** Folder-note page-hierarchy helpers (Phase 1 feedback: pages & subpages). */
import { describe, expect, it } from 'vitest'
import { folderNoteOf, isFolderNote, pageFolderOf } from '@/utils/paths'

describe('page hierarchy (folder-note convention)', () => {
  it('derives a folder note path', () => {
    expect(folderNoteOf('Machine Learning')).toBe('Machine Learning/Machine Learning.md')
    expect(folderNoteOf('AI/Maths')).toBe('AI/Maths/Maths.md')
  })

  it('recognises a folder note', () => {
    expect(isFolderNote('AI/AI.md')).toBe(true)
    expect(isFolderNote('AI/Maths/Maths.md')).toBe(true)
    expect(isFolderNote('AI/Regression.md')).toBe(false)
    expect(isFolderNote('Top level.md')).toBe(false)
  })

  it('returns the owned folder for a page with subpages', () => {
    expect(pageFolderOf('AI/AI.md')).toBe('AI')
    expect(pageFolderOf('AI/Regression.md')).toBeNull()
  })
})
