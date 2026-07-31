// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import {
  normalizePath,
  dirname,
  basename,
  extension,
  stem,
  joinPath,
  isMarkdown,
  isWithin,
  sanitizeName,
  uniquePath,
  isImage,
} from '@/utils/paths'

describe('path utilities', () => {
  it('normalizes separators and stray slashes', () => {
    expect(normalizePath('/a//b\\c/')).toBe('a/b/c')
    expect(normalizePath('note.md')).toBe('note.md')
  })

  it('splits dirname/basename/stem/extension', () => {
    expect(dirname('a/b/c.md')).toBe('a/b')
    expect(dirname('c.md')).toBe('')
    expect(basename('a/b/c.md')).toBe('c.md')
    expect(stem('a/b/c.md')).toBe('c')
    expect(extension('a/b/c.MD')).toBe('md')
    expect(extension('no-ext')).toBe('')
  })

  it('joins path segments', () => {
    expect(joinPath('', 'note.md')).toBe('note.md')
    expect(joinPath('folder', 'note.md')).toBe('folder/note.md')
  })

  it('detects markdown and images', () => {
    expect(isMarkdown('x/y.md')).toBe(true)
    expect(isMarkdown('x/y.pdf')).toBe(false)
    expect(isImage('a.PNG')).toBe(true)
  })

  it('checks folder containment', () => {
    expect(isWithin('a', 'a/b.md')).toBe(true)
    expect(isWithin('a', 'ab/b.md')).toBe(false)
    expect(isWithin('', 'anything.md')).toBe(true)
  })

  it('sanitizes names but keeps spaces', () => {
    expect(sanitizeName('My Note: draft?')).toBe('My Note draft')
    expect(sanitizeName('a/b\\c')).toBe('abc')
    expect(sanitizeName('   ')).toBe('Untitled')
    expect(sanitizeName('name...')).toBe('name')
  })

  it('generates unique paths on collision', () => {
    const existing = new Set(['n.md', 'n 1.md'])
    expect(uniquePath('n.md', (p) => existing.has(p))).toBe('n 2.md')
    expect(uniquePath('free.md', (p) => existing.has(p))).toBe('free.md')
  })
})
