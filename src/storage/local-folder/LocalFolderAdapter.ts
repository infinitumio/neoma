// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Vault backed by a real folder on the user's device via the File System
 * Access API (Chromium-based browsers). Notes are plain `.md` files on disk;
 * nothing is ever uploaded. Deleted files are copied into the IndexedDB
 * trash before removal so deletion is recoverable, and folder permission is
 * requested only after an explicit user action.
 */
import type { FileEntry, StorageAdapter, TrashEntry, VaultKind } from '@/types'
import { db } from '../db'
import { AlreadyExistsError, NotFoundError, PermissionError } from '../errors'
import { normalizePath, dirname, basename, isWithin } from '@/utils/paths'
import { generateId } from '@/utils/misc'

export function supportsLocalFolders(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

export async function verifyHandlePermission(
  handle: FileSystemDirectoryHandle,
  withRequest: boolean,
): Promise<boolean> {
  const descriptor = { mode: 'readwrite' as const }
  if ((await handle.queryPermission?.(descriptor)) === 'granted') return true
  if (withRequest && (await handle.requestPermission?.(descriptor)) === 'granted') return true
  return false
}

export class LocalFolderAdapter implements StorageAdapter {
  readonly kind: VaultKind = 'local-folder'
  private root: FileSystemDirectoryHandle | null = null

  constructor(readonly vaultId: string) {}

  async init(): Promise<void> {
    const record = await db.handles.get(this.vaultId)
    if (!record) throw new PermissionError('No saved folder handle for this vault')
    this.root = record.handle
    // Only *query* here — requesting permission requires a user gesture, and
    // the UI calls requestAccess() from an explicit click when needed.
    if ((await this.root.queryPermission?.({ mode: 'readwrite' })) !== 'granted') {
      throw new PermissionError()
    }
  }

  /** Must be invoked from a user gesture (click) to re-grant access. */
  async requestAccess(): Promise<boolean> {
    const record = await db.handles.get(this.vaultId)
    if (!record) return false
    if (await verifyHandlePermission(record.handle, true)) {
      this.root = record.handle
      return true
    }
    return false
  }

  private getRoot(): FileSystemDirectoryHandle {
    if (!this.root) throw new PermissionError()
    return this.root
  }

  private async getDir(path: string, create = false): Promise<FileSystemDirectoryHandle> {
    let dir = this.getRoot()
    if (!path) return dir
    for (const segment of normalizePath(path).split('/')) {
      try {
        dir = await dir.getDirectoryHandle(segment, { create })
      } catch (err) {
        throw this.translate(err, path)
      }
    }
    return dir
  }

  private async getFile(path: string, create = false): Promise<FileSystemFileHandle> {
    const clean = normalizePath(path)
    const dir = await this.getDir(dirname(clean), create)
    try {
      return await dir.getFileHandle(basename(clean), { create })
    } catch (err) {
      throw this.translate(err, path)
    }
  }

  private translate(err: unknown, path: string): Error {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError')
        return new PermissionError()
      if (err.name === 'NotFoundError') return new NotFoundError(path)
    }
    return err instanceof Error ? err : new Error(String(err))
  }

  async list(): Promise<FileEntry[]> {
    const out: FileEntry[] = []
    const walk = async (dir: FileSystemDirectoryHandle, prefix: string) => {
      for await (const [name, handle] of dir.entries()) {
        if (name.startsWith('.')) continue // .git, .obsidian, .DS_Store…
        const path = prefix ? `${prefix}/${name}` : name
        if (handle.kind === 'directory') {
          out.push({ path, kind: 'folder' })
          await walk(handle as FileSystemDirectoryHandle, path)
        } else {
          const file = await (handle as FileSystemFileHandle).getFile()
          out.push({
            path,
            kind: 'file',
            size: file.size,
            createdAt: file.lastModified,
            modifiedAt: file.lastModified,
          })
        }
      }
    }
    try {
      await walk(this.getRoot(), '')
    } catch (err) {
      throw this.translate(err, '/')
    }
    return out
  }

  async stat(path: string): Promise<FileEntry | null> {
    try {
      const handle = await this.getFile(path)
      const file = await handle.getFile()
      return {
        path: normalizePath(path),
        kind: 'file',
        size: file.size,
        createdAt: file.lastModified,
        modifiedAt: file.lastModified,
      }
    } catch (err) {
      if (err instanceof PermissionError) throw err
    }
    try {
      await this.getDir(path)
      return { path: normalizePath(path), kind: 'folder' }
    } catch {
      return null
    }
  }

  async exists(path: string): Promise<boolean> {
    return (await this.stat(path)) !== null
  }

  async readText(path: string): Promise<string> {
    const handle = await this.getFile(path)
    return (await handle.getFile()).text()
  }

  async writeText(path: string, content: string): Promise<void> {
    const handle = await this.getFile(path, true)
    // createWritable writes to a temporary file and swaps on close (atomic).
    const writable = await handle.createWritable()
    try {
      await writable.write(content)
    } finally {
      await writable.close()
    }
  }

  async readBinary(path: string): Promise<Blob> {
    const handle = await this.getFile(path)
    return handle.getFile()
  }

  async writeBinary(path: string, data: Blob): Promise<void> {
    const handle = await this.getFile(path, true)
    const writable = await handle.createWritable()
    try {
      await writable.write(data)
    } finally {
      await writable.close()
    }
  }

  private async copyToTrash(path: string): Promise<void> {
    const handle = await this.getFile(path)
    const file = await handle.getFile()
    const isBinary = !path.toLowerCase().endsWith('.md')
    await db.trash.add({
      id: generateId(),
      vaultId: this.vaultId,
      originalPath: normalizePath(path),
      deletedAt: Date.now(),
      isBinary,
      text: isBinary ? undefined : await file.text(),
      blob: isBinary ? file : undefined,
      size: file.size,
      createdAt: file.lastModified,
      modifiedAt: file.lastModified,
    })
  }

  async deleteFile(path: string): Promise<void> {
    const clean = normalizePath(path)
    await this.copyToTrash(clean)
    const dir = await this.getDir(dirname(clean))
    try {
      await dir.removeEntry(basename(clean))
    } catch (err) {
      throw this.translate(err, path)
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const from = normalizePath(oldPath)
    const to = normalizePath(newPath)
    if (from === to) return
    if (await this.exists(to)) throw new AlreadyExistsError(newPath)
    const content = await this.readBinary(from)
    if (from.toLowerCase().endsWith('.md')) {
      await this.writeText(to, await content.text())
    } else {
      await this.writeBinary(to, content)
    }
    const dir = await this.getDir(dirname(from))
    await dir.removeEntry(basename(from))
  }

  async createFolder(path: string): Promise<void> {
    await this.getDir(path, true)
  }

  async deleteFolder(path: string): Promise<void> {
    const clean = normalizePath(path)
    const entries = await this.list()
    for (const entry of entries) {
      if (entry.kind === 'file' && isWithin(clean, entry.path)) {
        await this.copyToTrash(entry.path)
      }
    }
    const dir = await this.getDir(dirname(clean))
    try {
      await dir.removeEntry(basename(clean), { recursive: true })
    } catch (err) {
      throw this.translate(err, path)
    }
  }

  async renameFolder(oldPath: string, newPath: string): Promise<void> {
    const from = normalizePath(oldPath)
    const to = normalizePath(newPath)
    if (from === to) return
    if (await this.exists(to)) throw new AlreadyExistsError(newPath)
    const entries = await this.list()
    await this.createFolder(to)
    for (const entry of entries) {
      if (!isWithin(from, entry.path)) continue
      const target = to + entry.path.slice(from.length)
      if (entry.kind === 'folder') {
        await this.createFolder(target)
      } else if (entry.path.toLowerCase().endsWith('.md')) {
        await this.writeText(target, await this.readText(entry.path))
      } else {
        await this.writeBinary(target, await this.readBinary(entry.path))
      }
    }
    const dir = await this.getDir(dirname(from))
    await dir.removeEntry(basename(from), { recursive: true })
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
    if (rec.isBinary && rec.blob) {
      await this.writeBinary(target, rec.blob)
    } else {
      await this.writeText(target, rec.text ?? '')
    }
    await db.trash.delete(id)
    return target
  }

  async purgeTrashItem(id: string): Promise<void> {
    await db.trash.delete(id)
  }

  close(): void {
    this.root = null
  }
}
