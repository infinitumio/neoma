// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Browser-managed vault stored in IndexedDB (via Dexie). Works fully
 * offline, autosaves locally and supports multiple vaults. Users are warned
 * in the UI that clearing browser site data removes these vaults — the
 * export tools exist so nothing is ever locked in.
 */
import type { FileEntry, StorageAdapter, TrashEntry, VaultKind } from '@/types'
import { db, type FileRecord } from '../db'
import { AlreadyExistsError, NotFoundError } from '../errors'
import { normalizePath, dirname, isWithin } from '@/utils/paths'
import { generateId } from '@/utils/misc'

export class BrowserVaultAdapter implements StorageAdapter {
  readonly kind: VaultKind = 'browser'

  constructor(readonly vaultId: string) {}

  async init(): Promise<void> {
    await db.open()
  }

  private async record(path: string): Promise<FileRecord | undefined> {
    return db.files.get([this.vaultId, normalizePath(path)])
  }

  async list(): Promise<FileEntry[]> {
    const files = await db.files.where('vaultId').equals(this.vaultId).toArray()
    const folders = await db.folders.where('vaultId').equals(this.vaultId).toArray()
    const folderPaths = new Set(folders.map((f) => f.path))
    // Implicit folders from file paths.
    for (const file of files) {
      let dir = dirname(file.path)
      while (dir) {
        folderPaths.add(dir)
        dir = dirname(dir)
      }
    }
    return [
      ...[...folderPaths].map((path): FileEntry => ({ path, kind: 'folder' })),
      ...files.map((f): FileEntry => ({
        path: f.path,
        kind: 'file',
        size: f.size,
        createdAt: f.createdAt,
        modifiedAt: f.modifiedAt,
      })),
    ]
  }

  async stat(path: string): Promise<FileEntry | null> {
    const rec = await this.record(path)
    if (rec) {
      return {
        path: rec.path,
        kind: 'file',
        size: rec.size,
        createdAt: rec.createdAt,
        modifiedAt: rec.modifiedAt,
      }
    }
    const folder = await db.folders.get([this.vaultId, normalizePath(path)])
    return folder ? { path: folder.path, kind: 'folder' } : null
  }

  async exists(path: string): Promise<boolean> {
    return (await this.stat(path)) !== null
  }

  async readText(path: string): Promise<string> {
    const rec = await this.record(path)
    if (!rec) throw new NotFoundError(path)
    if (rec.isBinary) throw new Error(`Not a text file: ${path}`)
    return rec.text ?? ''
  }

  async writeText(path: string, content: string): Promise<void> {
    const clean = normalizePath(path)
    const existing = await this.record(clean)
    const now = Date.now()
    await db.files.put({
      vaultId: this.vaultId,
      path: clean,
      isBinary: false,
      text: content,
      size: content.length,
      createdAt: existing?.createdAt ?? now,
      modifiedAt: now,
    })
  }

  async readBinary(path: string): Promise<Blob> {
    const rec = await this.record(path)
    if (!rec) throw new NotFoundError(path)
    if (!rec.isBinary) return new Blob([rec.text ?? ''], { type: 'text/markdown' })
    return rec.blob ?? new Blob([])
  }

  async writeBinary(path: string, data: Blob): Promise<void> {
    const clean = normalizePath(path)
    const existing = await this.record(clean)
    const now = Date.now()
    await db.files.put({
      vaultId: this.vaultId,
      path: clean,
      isBinary: true,
      blob: data,
      size: data.size,
      createdAt: existing?.createdAt ?? now,
      modifiedAt: now,
    })
  }

  async deleteFile(path: string): Promise<void> {
    const clean = normalizePath(path)
    const rec = await this.record(clean)
    if (!rec) throw new NotFoundError(path)
    await db.transaction('rw', db.files, db.trash, async () => {
      await db.trash.add({
        id: generateId(),
        vaultId: this.vaultId,
        originalPath: rec.path,
        deletedAt: Date.now(),
        isBinary: rec.isBinary,
        text: rec.text,
        blob: rec.blob,
        size: rec.size,
        createdAt: rec.createdAt,
        modifiedAt: rec.modifiedAt,
      })
      await db.files.delete([this.vaultId, clean])
    })
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const from = normalizePath(oldPath)
    const to = normalizePath(newPath)
    if (from === to) return
    const rec = await this.record(from)
    if (!rec) throw new NotFoundError(oldPath)
    if (await this.exists(to)) throw new AlreadyExistsError(newPath)
    await db.transaction('rw', db.files, async () => {
      await db.files.delete([this.vaultId, from])
      await db.files.put({ ...rec, path: to, modifiedAt: Date.now() })
    })
  }

  async createFolder(path: string): Promise<void> {
    await db.folders.put({ vaultId: this.vaultId, path: normalizePath(path) })
  }

  async deleteFolder(path: string): Promise<void> {
    const clean = normalizePath(path)
    const files = await db.files.where('vaultId').equals(this.vaultId).toArray()
    for (const file of files) {
      if (isWithin(clean, file.path)) await this.deleteFile(file.path)
    }
    const folders = await db.folders.where('vaultId').equals(this.vaultId).toArray()
    for (const folder of folders) {
      if (isWithin(clean, folder.path)) await db.folders.delete([this.vaultId, folder.path])
    }
  }

  async renameFolder(oldPath: string, newPath: string): Promise<void> {
    const from = normalizePath(oldPath)
    const to = normalizePath(newPath)
    if (from === to) return
    if (await this.exists(to)) throw new AlreadyExistsError(newPath)
    const files = await db.files.where('vaultId').equals(this.vaultId).toArray()
    await db.transaction('rw', db.files, db.folders, async () => {
      for (const file of files) {
        if (!isWithin(from, file.path)) continue
        const newFilePath = to + file.path.slice(from.length)
        await db.files.delete([this.vaultId, file.path])
        await db.files.put({ ...file, path: newFilePath })
      }
      const folders = await db.folders.where('vaultId').equals(this.vaultId).toArray()
      for (const folder of folders) {
        if (!isWithin(from, folder.path)) continue
        await db.folders.delete([this.vaultId, folder.path])
        await db.folders.put({ vaultId: this.vaultId, path: to + folder.path.slice(from.length) })
      }
    })
  }

  async listTrash(): Promise<TrashEntry[]> {
    const records = await db.trash.where('vaultId').equals(this.vaultId).toArray()
    return records
      .sort((a, b) => b.deletedAt - a.deletedAt)
      .map((r) => ({
        id: r.id,
        vaultId: r.vaultId,
        originalPath: r.originalPath,
        deletedAt: r.deletedAt,
        isBinary: r.isBinary,
        size: r.size,
      }))
  }

  async restoreFromTrash(id: string): Promise<string> {
    const rec = await db.trash.get(id)
    if (!rec) throw new NotFoundError(`trash:${id}`)
    let target = rec.originalPath
    if (await this.exists(target)) {
      const dot = target.lastIndexOf('.')
      target =
        dot === -1
          ? `${target} (restored)`
          : `${target.slice(0, dot)} (restored)${target.slice(dot)}`
    }
    await db.transaction('rw', db.files, db.trash, async () => {
      await db.files.put({
        vaultId: this.vaultId,
        path: target,
        isBinary: rec.isBinary,
        text: rec.text,
        blob: rec.blob,
        size: rec.size,
        createdAt: rec.createdAt,
        modifiedAt: Date.now(),
      })
      await db.trash.delete(id)
    })
    return target
  }

  async purgeTrashItem(id: string): Promise<void> {
    await db.trash.delete(id)
  }

  close(): void {
    // Shared Dexie connection stays open for other vaults.
  }

  /** Permanently delete all data for this vault (used by VaultManager). */
  static async destroy(vaultId: string): Promise<void> {
    await db.transaction('rw', db.files, db.folders, db.trash, async () => {
      await db.files.where('vaultId').equals(vaultId).delete()
      await db.folders.where('vaultId').equals(vaultId).delete()
      await db.trash.where('vaultId').equals(vaultId).delete()
    })
  }
}
