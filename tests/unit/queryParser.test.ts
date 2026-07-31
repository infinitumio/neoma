// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { parseQuery } from '@/search/queryParser'

describe('parseQuery', () => {
  it('separates terms, phrases and exclusions', () => {
    const parsed = parseQuery('alpha "exact phrase" -nope beta')
    expect(parsed.terms).toEqual(['alpha', 'beta'])
    expect(parsed.phrases).toEqual(['exact phrase'])
    expect(parsed.excluded).toEqual(['nope'])
  })

  it('parses tag/path/type filters', () => {
    const parsed = parseQuery('tag:#experiments path:Projects/ML type:literature q')
    expect(parsed.tag).toBe('experiments')
    expect(parsed.path).toBe('Projects/ML')
    expect(parsed.type).toBe('literature')
    expect(parsed.terms).toEqual(['q'])
  })

  it('treats bare #tag as a tag filter', () => {
    expect(parseQuery('#ml').tag).toBe('ml')
  })

  it('handles empty and whitespace input', () => {
    expect(parseQuery('')).toMatchObject({ terms: [], phrases: [], excluded: [] })
    expect(parseQuery('  "  " ').phrases).toEqual([])
  })
})
