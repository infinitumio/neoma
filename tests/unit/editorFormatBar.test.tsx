// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

// Declare the parameters, or `mock.calls[0][1]` has no type to index into and
// `tsc -b` (which npm run build uses, unlike tsc --noEmit) rejects the test.
const cmds = vi.hoisted(() => ({
  toggleBold: vi.fn((_view: unknown, _range: { from: number; to: number }) => true),
  toggleItalic: vi.fn((_view: unknown, _range: { from: number; to: number }) => true),
  toggleStrikethrough: vi.fn((_view: unknown, _range: { from: number; to: number }) => true),
  toggleCode: vi.fn((_view: unknown, _range: { from: number; to: number }) => true),
  insertWikiLink: vi.fn((_view: unknown, _range: { from: number; to: number }) => true),
  applyHighlight: vi.fn(
    (_view: unknown, _color: string | null, _range: { from: number; to: number }) => true,
  ),
  HIGHLIGHT_COLORS: ['yellow', 'green', 'blue'],
}))
vi.mock('@/editor/markdownCommands', () => cmds)

import { EditorFormatBar } from '@/components/EditorFormatBar'

/** Minimal stand-in for the CodeMirror view the bar drives. */
function fakeView(from = 3, to = 8) {
  return {
    state: { selection: { main: { from, to } } },
    focus: vi.fn(),
  } as never
}

describe('EditorFormatBar', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('offers every action the desktop toolbar does', () => {
    // Parity matters: neither platform should be able to do something the
    // other cannot.
    render(<EditorFormatBar view={fakeView()} bottom={0} />)
    for (const label of [
      'Bold',
      'Italic',
      'Strikethrough',
      'Inline code',
      'Wiki link',
      'Highlight colour',
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy()
    }
  })

  it('opens the highlight palette and applies a colour', () => {
    const view = fakeView(3, 8)
    render(<EditorFormatBar view={view} bottom={0} />)
    expect(screen.queryByLabelText('Highlight yellow')).toBeNull()
    fireEvent.click(screen.getByLabelText('Highlight colour'))
    fireEvent.click(screen.getByLabelText('Highlight yellow'))
    expect(cmds.applyHighlight).toHaveBeenCalledTimes(1)
    expect(cmds.applyHighlight.mock.calls[0][1]).toBe('yellow')
    expect(cmds.applyHighlight.mock.calls[0][2]).toEqual({ from: 3, to: 8 })
  })

  it('can clear a highlight', () => {
    render(<EditorFormatBar view={fakeView()} bottom={0} />)
    fireEvent.click(screen.getByLabelText('Highlight colour'))
    fireEvent.click(screen.getByLabelText('Remove highlight'))
    expect(cmds.applyHighlight.mock.calls[0][1]).toBeNull()
  })

  it('applies a command to the selection live at tap time', () => {
    const view = fakeView(3, 8)
    render(<EditorFormatBar view={view} bottom={0} />)
    fireEvent.click(screen.getByLabelText('Bold'))
    expect(cmds.toggleBold).toHaveBeenCalledTimes(1)
    expect(cmds.toggleBold.mock.calls[0][1]).toEqual({ from: 3, to: 8 })
  })

  it('returns focus to the editor so the keyboard stays up', () => {
    const view = fakeView()
    render(<EditorFormatBar view={view} bottom={0} />)
    fireEvent.click(screen.getByLabelText('Strikethrough'))
    expect(cmds.toggleStrikethrough).toHaveBeenCalled()
    expect((view as unknown as { focus: ReturnType<typeof vi.fn> }).focus).toHaveBeenCalled()
  })

  it('swallows pointerdown so tapping never blurs the editor', () => {
    // A blur dismisses the keyboard, which would close the bar being tapped.
    render(<EditorFormatBar view={fakeView()} bottom={0} />)
    const bar = screen.getByRole('toolbar', { name: 'Format text' })
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    fireEvent(bar, event)
    expect(event.defaultPrevented).toBe(true)
  })
})
