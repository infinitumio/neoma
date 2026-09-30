// SPDX-License-Identifier: AGPL-3.0-or-later
import 'fake-indexeddb/auto'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/search/SearchClient', () => ({
  SearchClient: class {
    async upsertWithMeta() {
      return []
    }
    terminate() {}
  },
}))
import { createBrowserVault } from '@/storage/VaultManager'
import {
  openVault,
  closeVault,
  createNote,
  updateNoteContent,
  flushAllSaves,
  saveNoteNow,
  getAdapter,
  useVault,
} from '@/app/vaultStore'
import { useSettings } from '@/settings/settingsStore'

describe('durable saves before export and vault changes', () => {
  beforeEach(async () => {
    useSettings.getState().update('autosaveDelayMs', 5000)
    await openVault(await createBrowserVault('Save regression'))
    await createNote('', 'Note', 'baseline')
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await closeVault()
  })
  it('flushes a pending five-second autosave before a backup reads storage', async () => {
    updateNoteContent('Note.md', 'latest edit')
    expect(await getAdapter()!.readText('Note.md')).toBe('baseline')
    await flushAllSaves()
    expect(await getAdapter()!.readText('Note.md')).toBe('latest edit')
  })
  it('waits for an in-flight write and persists an edit made during it', async () => {
    const adapter = getAdapter()!
    const write = adapter.writeText.bind(adapter)
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    vi.spyOn(adapter, 'writeText').mockImplementationOnce(async (path, content) => {
      await gate
      await write(path, content)
    })
    updateNoteContent('Note.md', 'first edit')
    const first = saveNoteNow('Note.md')
    updateNoteContent('Note.md', 'second edit')
    const flush = flushAllSaves()
    release()
    await Promise.all([first, flush])
    expect(await adapter.readText('Note.md')).toBe('second edit')
    expect(useVault.getState().notes.get('Note.md')?.saveState).toBe('saved')
  })
  it('rejects a backup flush on storage failure instead of reporting success', async () => {
    vi.spyOn(getAdapter()!, 'writeText').mockRejectedValueOnce(new Error('Storage is full'))
    updateNoteContent('Note.md', 'unsaved edit')
    await expect(flushAllSaves()).rejects.toThrow('Storage is full')
    expect(useVault.getState().notes.get('Note.md')?.saveState).toBe('error')
  })
  it('saves the old vault before switching and leaves the new vault untouched', async () => {
    const old = getAdapter()!
    updateNoteContent('Note.md', 'old vault latest edit')
    await openVault(await createBrowserVault('Second vault'))
    expect(await old.readText('Note.md')).toBe('old vault latest edit')
    expect(await getAdapter()!.list()).toEqual([])
  })
})
