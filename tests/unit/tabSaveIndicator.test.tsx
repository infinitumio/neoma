// SPDX-License-Identifier: AGPL-3.0-or-later
import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { TabsBar } from '@/components/TabsBar'
import { useTabs } from '@/app/tabsStore'
import { useVault, type OpenNote } from '@/app/vaultStore'
import type { SaveState } from '@/types'

function seed(saveState: SaveState) {
  const path = 'Note.md'
  const note: OpenNote = { content: 'hello', saveState, diskModifiedAt: 0 }
  useVault.setState({ notes: new Map([[path, note]]) })
  useTabs.setState({
    tabs: [{ id: 't1', type: 'note', path, pinned: false }],
    activeId: 't1',
  } as never)
}

describe('TabsBar save indicator', () => {
  beforeEach(() => cleanup())

  it('marks a note with unsaved edits', () => {
    seed('unsaved')
    render(<TabsBar />)
    expect(screen.getByLabelText('Unsaved changes')).toBeTruthy()
  })

  it('shows no indicator once the note is saved', () => {
    seed('saved')
    render(<TabsBar />)
    expect(screen.queryByLabelText('Unsaved changes')).toBeNull()
    expect(screen.queryByLabelText('Save failed')).toBeNull()
  })

  it('flags a failed save instead of going quiet', () => {
    // The regression: 'error' is neither 'unsaved' nor 'saving', so the dot
    // disappeared on failure — the tab looked clean exactly when the note was
    // not on disk. On phones this was the last remaining signal, because the
    // status bar is display:none and the error toast was suppressed.
    seed('error')
    render(<TabsBar />)
    expect(screen.getByLabelText('Save failed')).toBeTruthy()
  })
})
