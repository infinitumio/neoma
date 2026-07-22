// SPDX-License-Identifier: AGPL-3.0-or-later
/** Toggling task-list checkboxes from the reading view. */
import { describe, expect, it } from 'vitest'
import { toggleTaskInMarkdown } from '@/components/Preview'

describe('toggleTaskInMarkdown', () => {
  const md = ['- [ ] first', '- [x] second', '  - [ ] nested', '1. [ ] ordered'].join('\n')

  it('checks an unchecked item by index', () => {
    expect(toggleTaskInMarkdown(md, 0)).toContain('- [x] first')
  })

  it('unchecks a checked item by index', () => {
    expect(toggleTaskInMarkdown(md, 1)).toContain('- [ ] second')
  })

  it('toggles a nested item without touching others', () => {
    const out = toggleTaskInMarkdown(md, 2)
    expect(out).toContain('  - [x] nested')
    expect(out).toContain('- [ ] first')
    expect(out).toContain('- [x] second')
  })

  it('handles ordered-list tasks', () => {
    expect(toggleTaskInMarkdown(md, 3)).toContain('1. [x] ordered')
  })

  it('is a no-op for an out-of-range index', () => {
    expect(toggleTaskInMarkdown(md, 9)).toBe(md)
  })
})
