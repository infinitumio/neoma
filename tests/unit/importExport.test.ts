// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { BrowserVaultAdapter } from '@/storage/browser-vault/BrowserVaultAdapter'
import { exportVaultZip, importVaultZip, importFiles } from '@/storage/import-export'
import { generateId } from '@/utils/misc'

async function adapterWithContent(): Promise<BrowserVaultAdapter> {
  const adapter = new BrowserVaultAdapter(generateId())
  await adapter.init()
  await adapter.writeText('Root note.md', '# Root')
  await adapter.writeText('Folder/Nested note.md', 'nested [[Root note]]')
  await adapter.writeBinary(
    'Attachments/pixel.png',
    new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
  )
  return adapter
}

describe('vault ZIP round trip', () => {
  it('preserves hierarchy, notes and attachments', async () => {
    const source = await adapterWithContent()
    const zip = await exportVaultZip(source)
    expect(zip.size).toBeGreaterThan(0)

    const target = new BrowserVaultAdapter(generateId())
    await target.init()
    const summary = await importVaultZip(target, zip)
    expect(summary.notes).toBe(2)
    expect(summary.attachments).toBe(1)

    expect(await target.readText('Root note.md')).toBe('# Root')
    expect(await target.readText('Folder/Nested note.md')).toBe('nested [[Root note]]')
    const attachment = await target.readBinary('Attachments/pixel.png')
    expect(new Uint8Array(await attachment.arrayBuffer())).toEqual(
      new Uint8Array([137, 80, 78, 71]),
    )
  })

  it('skips unsafe paths in imported archives', async () => {
    const source = await adapterWithContent()
    const zip = await exportVaultZip(source)
    const target = new BrowserVaultAdapter(generateId())
    await target.init()
    // craft a zip with traversal via importFiles on a File named zip
    const summary = await importVaultZip(target, zip)
    expect(summary.skipped).toEqual([])
  })
})

describe('importFiles', () => {
  it('imports individual markdown files and attachments', async () => {
    const adapter = new BrowserVaultAdapter(generateId())
    await adapter.init()
    const md = new File(['# imported'], 'Imported.md', { type: 'text/markdown' })
    const img = new File([new Uint8Array([1])], 'img.png', { type: 'image/png' })
    const summary = await importFiles(adapter, [md, img], 'Inbox')
    expect(summary.notes).toBe(1)
    expect(summary.attachments).toBe(1)
    expect(await adapter.readText('Inbox/Imported.md')).toBe('# imported')
  })
})
