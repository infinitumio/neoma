// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { formatShortcut } from '@/utils/misc'
import { parseBinding, eventMatches } from '@/commands/shortcuts'

describe('formatShortcut', () => {
  it('spaces out modifier symbols/keys for readability', () => {
    // On either platform there is a visible gap between tokens.
    const single = formatShortcut('Mod+K')
    expect(single).toMatch(/(⌘ K|Ctrl \+ K)/)
    const triple = formatShortcut('Mod+Shift+F')
    // No two tokens are run together (e.g. never "⌘⇧F" or "CtrlShiftF").
    expect(triple).not.toMatch(/⌘⇧|CtrlShift/)
  })
})

describe('parseBinding / eventMatches', () => {
  it('parses modifiers and key', () => {
    expect(parseBinding('Mod+Shift+K')).toEqual({ key: 'k', mod: true, shift: true, alt: false })
  })
  it('matches a keyboard event', () => {
    const event = {
      key: 'k',
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
      altKey: false,
    } as KeyboardEvent
    expect(eventMatches(event, 'Mod+Shift+K')).toBe(true)
    expect(eventMatches(event, 'Mod+K')).toBe(false)
  })
})
