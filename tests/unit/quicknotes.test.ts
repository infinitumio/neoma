// SPDX-License-Identifier: AGPL-3.0-or-later
/** Inserting promoted quick notes under a single heading. */
import { describe, expect, it } from 'vitest'
import { insertUnderHeading } from '@/journal/quicknotes'

describe('insertUnderHeading', () => {
  it('creates the section when missing', () => {
    const out = insertUnderHeading('# Day\n\nSome text', 'Quick notes', '- first')
    expect(out).toContain('## Quick notes')
    expect(out.trimEnd().endsWith('- first')).toBe(true)
  })

  it('appends into an existing section, above the next heading', () => {
    const md = ['## Quick notes', '', '- one', '', '## Next actions', '', '- [ ]'].join('\n')
    const out = insertUnderHeading(md, 'Quick notes', '- two')
    const lines = out.split('\n')
    // '- two' sits after '- one' and before the Next actions heading.
    expect(lines.indexOf('- two')).toBeGreaterThan(lines.indexOf('- one'))
    expect(lines.indexOf('- two')).toBeLessThan(lines.indexOf('## Next actions'))
  })

  it('is case-insensitive on the heading', () => {
    const out = insertUnderHeading('## quick NOTES\n\n- a', 'Quick notes', '- b')
    expect(out).not.toContain('\n## Quick notes\n\n') // did not create a duplicate section
    expect(out).toContain('- b')
  })
})
