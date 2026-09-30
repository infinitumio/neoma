// SPDX-License-Identifier: AGPL-3.0-or-later
import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

const tauri = vi.hoisted(() => ({
  isMobileApp: vi.fn(() => false),
  isDesktopApp: vi.fn(() => false),
  isTauri: vi.fn(() => false),
}))
vi.mock('@/desktop/tauri', () => tauri)

import { buildDefaultCommands } from '@/commands/defaultCommands'
import { useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'

/** Open one note so the note-scoped export commands become applicable. */
function withOpenNote() {
  const path = 'Note.md'
  // hasVault() reads status, not the vault object.
  useVault.setState({
    status: 'ready',
    notes: new Map([[path, { content: 'hi', saveState: 'saved', diskModifiedAt: 0 }]]),
    vault: { id: 'v', name: 'V', kind: 'browser', createdAt: 0, lastOpenedAt: 0 },
  } as never)
  useTabs.setState({
    tabs: [{ id: 't1', type: 'note', path, pinned: false }],
    activeId: 't1',
  } as never)
}

function available(id: string): boolean {
  const cmd = buildDefaultCommands().find((c) => c.id === id)
  if (!cmd) throw new Error(`no such command: ${id}`)
  return cmd.isAvailable ? cmd.isAvailable() : true
}

describe('Export note as PDF (print)', () => {
  beforeEach(() => {
    withOpenNote()
    tauri.isMobileApp.mockReturnValue(false)
  })
  afterEach(() => vi.clearAllMocks())

  it('is offered on desktop and the web, where printing works', () => {
    expect(available('note.export-pdf')).toBe(true)
  })

  it('is withheld on the phone app, where window.print() does nothing', () => {
    // Probed on an iPhone 17 Pro simulator: window.print() exists but returns
    // in ~1ms presenting no print UI. Offering it anyway is a control that
    // cannot work — App Store Guideline 2.1.
    tauri.isMobileApp.mockReturnValue(true)
    expect(available('note.export-pdf')).toBe(false)
  })
})
