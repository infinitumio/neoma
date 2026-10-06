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

  const key = (init: Partial<KeyboardEvent>) =>
    ({ metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...init }) as KeyboardEvent

  it('matches Shift bindings whose character changes (Mod+Shift+\\ arrives as |)', () => {
    const event = key({ key: '|', code: 'Backslash', metaKey: true, shiftKey: true })
    expect(eventMatches(event, 'Mod+Shift+\\')).toBe(true)
    expect(eventMatches(event, 'Mod+\\')).toBe(false)
  })

  it('matches Option bindings on a Mac, where Option+N is a dead key', () => {
    const event = key({ key: 'Dead', code: 'KeyN', metaKey: true, altKey: true })
    expect(eventMatches(event, 'Mod+Alt+N')).toBe(true)
    expect(eventMatches(event, 'Mod+Alt+W')).toBe(false)
  })

  it('keeps layout-aware matching when no modifier changes the character', () => {
    // AZERTY: the key labelled A sits where QWERTY has Q.
    expect(eventMatches(key({ key: 'a', code: 'KeyQ', ctrlKey: true }), 'Mod+A')).toBe(true)
    expect(eventMatches(key({ key: 'a', code: 'KeyQ', ctrlKey: true }), 'Mod+Q')).toBe(false)
  })

  it('matches a bare function key binding', () => {
    expect(eventMatches(key({ key: 'F1', code: 'F1' }), 'F1')).toBe(true)
  })
})
