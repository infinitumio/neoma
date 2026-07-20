// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { parseFrontmatter, updateFrontmatter, asStringArray } from '@/markdown/frontmatter'

const NOTE = `---
title: Test note
created: 2026-07-20
custom-field: keep me
tags:
  - one
  - two
---

Body text here.
`

describe('frontmatter', () => {
  it('parses fields and body', () => {
    const result = parseFrontmatter(NOTE)
    expect(result.data.title).toBe('Test note')
    expect(result.body).toBe('\nBody text here.\n')
    expect(result.raw).toContain('custom-field')
  })

  it('returns empty data when there is no frontmatter', () => {
    const result = parseFrontmatter('Just text')
    expect(result.data).toEqual({})
    expect(result.body).toBe('Just text')
    expect(result.bodyOffset).toBe(0)
  })

  it('preserves unknown fields when updating', () => {
    const updated = updateFrontmatter(NOTE, { title: 'Renamed' })
    expect(updated).toContain('custom-field: keep me')
    expect(updated).toContain('title: Renamed')
    expect(updated).toContain('Body text here.')
  })

  it('creates frontmatter when none exists', () => {
    const updated = updateFrontmatter('Body only', { title: 'New' })
    expect(updated.startsWith('---\n')).toBe(true)
    expect(updated).toContain('title: New')
    expect(updated).toContain('Body only')
  })

  it('never rewrites unparseable YAML', () => {
    const broken = '---\n: : :bad yaml [\n---\nBody'
    expect(updateFrontmatter(broken, { title: 'x' })).toBe(broken)
  })

  it('normalises tag values with asStringArray', () => {
    expect(asStringArray(['a', 'b'])).toEqual(['a', 'b'])
    expect(asStringArray('single')).toEqual(['single'])
    expect(asStringArray(undefined)).toEqual([])
  })
})
