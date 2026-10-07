// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { noteSection } from '@/markdown/sections'

const NOTE = `---
title: Waves
---
# Waves

Intro.

## Interference

Two waves add.

### Beats

Close frequencies.

## Diffraction

Bending.
`

describe('noteSection', () => {
  it('returns the body without frontmatter when no heading is given', () => {
    const body = noteSection(NOTE)!
    expect(body).not.toContain('title: Waves')
    expect(body).toContain('# Waves')
  })

  it('returns a heading with its subsections, up to the next sibling', () => {
    const s = noteSection(NOTE, 'Interference')!
    expect(s.startsWith('## Interference')).toBe(true)
    expect(s).toContain('Close frequencies.')
    expect(s).not.toContain('Diffraction')
  })

  it('runs to the end of the note for the last section, matching case-insensitively', () => {
    expect(noteSection(NOTE, 'diffraction')).toBe('## Diffraction\n\nBending.')
  })

  it('returns null for a heading that does not exist, and ignores # inside code', () => {
    expect(noteSection(NOTE, 'Optics')).toBeNull()
    expect(noteSection('```\n# not a heading\n```\n', 'not a heading')).toBeNull()
  })
})
