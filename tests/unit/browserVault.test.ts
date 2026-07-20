// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment node
import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach } from 'vitest'
import { BrowserVaultAdapter } from '@/storage/browser-vault/BrowserVaultAdapter'
import { db } from '@/storage/db'
import { generateId } from '@/utils/misc'

async function freshAdapter(): Promise<BrowserVaultAdapter> {
  const adapter = new BrowserVaultAdapter(generateId())
  await adapter.init()
  return adapter
}

describe('BrowserVaultAdapter', () => {
  beforeEach(async () => {
    await db.files.clear()
    await db.folders.clear()
    await db.trash.clear()
  })

  it('writes and reads text files', async () => {
    const adapter = await freshAdapter()
    await adapter.writeText('a/b.md', '# hello')
    expect(await adapter.readText('a/b.md')).toBe('# hello')
    expect(await adapter.exists('a/b.md')).toBe(true)
    expect(await adapter.exists('nope.md')).toBe(false)
  })

  it('lists files and implicit folders', async () => {
    const adapter = await freshAdapter()
    await adapter.writeText('x/y/z.md', 'deep')
    const entries = await adapter.list()
    const paths = entries.map((e) => `${e.kind}:${e.path}`).sort()
    expect(paths).toContain('file:x/y/z.md')
    expect(paths).toContain('folder:x')
    expect(paths).toContain('folder:x/y')
  })

  it('keeps createdAt across writes', async () => {
    const adapter = await freshAdapter()
    await adapter.writeText('n.md', 'v1')
    const first = await adapter.stat('n.md')
    await new Promise((r) => setTimeout(r, 5))
    await adapter.writeText('n.md', 'v2')
    const second = await adapter.stat('n.md')
    expect(second?.createdAt).toBe(first?.createdAt)
    expect(second!.modifiedAt!).toBeGreaterThanOrEqual(first!.modifiedAt!)
  })

  it('renames and refuses collisions', async () => {
    const adapter = await freshAdapter()
    await adapter.writeText('one.md', '1')
    await adapter.writeText('two.md', '2')
    await adapter.rename('one.md', 'uno.md')
    expect(await adapter.readText('uno.md')).toBe('1')
    await expect(adapter.rename('uno.md', 'two.md')).rejects.toThrow()
  })

  it('moves deleted files to trash and restores them', async () => {
    const adapter = await freshAdapter()
    await adapter.writeText('gone.md', 'bye')
    await adapter.deleteFile('gone.md')
    expect(await adapter.exists('gone.md')).toBe(false)
    const trash = await adapter.listTrash()
    expect(trash).toHaveLength(1)
    expect(trash[0].originalPath).toBe('gone.md')
    const restored = await adapter.restoreFromTrash(trash[0].id)
    expect(restored).toBe('gone.md')
    expect(await adapter.readText('gone.md')).toBe('bye')
  })

  it('restores to an alternative path when the original is taken', async () => {
    const adapter = await freshAdapter()
    await adapter.writeText('n.md', 'old')
    await adapter.deleteFile('n.md')
    await adapter.writeText('n.md', 'new')
    const [item] = await adapter.listTrash()
    const restored = await adapter.restoreFromTrash(item.id)
    expect(restored).toBe('n (restored).md')
    expect(await adapter.readText('n.md')).toBe('new')
    expect(await adapter.readText('n (restored).md')).toBe('old')
  })

  it('renames folders including children', async () => {
    const adapter = await freshAdapter()
    await adapter.writeText('dir/a.md', 'a')
    await adapter.writeText('dir/sub/b.md', 'b')
    await adapter.renameFolder('dir', 'renamed')
    expect(await adapter.readText('renamed/a.md')).toBe('a')
    expect(await adapter.readText('renamed/sub/b.md')).toBe('b')
    expect(await adapter.exists('dir/a.md')).toBe(false)
  })

  it('deletes folders recursively into trash', async () => {
    const adapter = await freshAdapter()
    await adapter.writeText('d/one.md', '1')
    await adapter.writeText('d/two.md', '2')
    await adapter.deleteFolder('d')
    expect(await adapter.exists('d/one.md')).toBe(false)
    expect(await adapter.listTrash()).toHaveLength(2)
  })

  it('stores binary attachments', async () => {
    const adapter = await freshAdapter()
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    await adapter.writeBinary('img/pic.png', blob)
    const roundTrip = await adapter.readBinary('img/pic.png')
    expect(new Uint8Array(await roundTrip.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('isolates vaults from each other', async () => {
    const a = await freshAdapter()
    const b = await freshAdapter()
    await a.writeText('same.md', 'vault a')
    expect(await b.exists('same.md')).toBe(false)
  })
})
