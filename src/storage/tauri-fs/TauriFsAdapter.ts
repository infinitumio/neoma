// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Vault backed by a real folder on disk in the Neoma desktop app (Tauri).
 * The macOS/iOS webview has no File System Access API, so instead of
 * FileSystemDirectoryHandle this adapter uses Tauri's native `fs` plugin to
 * read and write the user's `.md` files directly. Nothing is uploaded.
 *
 * Deleted files are copied into the IndexedDB trash before removal (recoverable,
 * exactly like the browser LocalFolderAdapter). The folder is chosen with the
 * native picker; access is scoped to the user's home directory (see
 * src-tauri/capabilities/default.json).
 */
import {
  readTextFile,
  writeTextFile,
  readFile,
  writeFile,
  mkdir,
  remove,
  rename,
  readDir,
  stat,
  exists as fsExists,
} from '@tauri-apps/plugin-fs'
import type { FileEntry, StorageAdapter, TrashEntry, VaultKind } from '@/types'
import { db } from '../db'
import { AlreadyExistsError, NotFoundError } from '../errors'
import { normalizePath, dirname, isWithin } from '@/utils/paths'
import { generateId } from '@/utils/misc'

export class TauriFsAdapter implements StorageAdapter {
  readonly kind: VaultKind = 'tauri-fs'
  private root = ''

  constructor(readonly vaultId: string) {}

  async init(): Promise<void> {
    const vault = await db.vaults.get(this.vaultId)
    if (!vault?.rootPath) throw new NotFoundError(`No folder path for vault ${this.vaultId}`)
    this.root = vault.rootPath.replace(/\/+$/, '')
    if (!(await fsExists(this.root))) {
      throw new NotFoundError(this.root)
    }
  }

  /** Absolute on-disk path for a vault-relative path. */
  private abs(path: string): string {
    const rel = normalizePath(path)
    return rel ? `${this.root}/${rel}` : this.root
  }

  async list(): Promise<FileEntry[]> {
    const out: FileEntry[] = []
    const walk = async (prefix: string): Promise<void> => {
      const entries = await readDir(this.abs(prefix))
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue // .git, .DS_Store, .obsidian…
        const path = prefix ? `${prefix}/${entry.name}` : entry.name
        if (entry.isDirectory) {
          out.push({ path, kind: 'folder' })
          await walk(path)
        } else if (entry.isFile) {
          const info = await stat(this.abs(path)).catch(() => null)
          const mtime = info?.mtime ? info.mtime.getTime() : Date.now()
          out.push({
            path,
            kind: 'file',
            size: info?.size ?? 0,
            createdAt: info?.birthtime ? info.birthtime.getTime() : mtime,
            modifiedAt: mtime,
          })
        }
      }
    }
    await walk('')
    return out
  }

  async stat(path: string): Promise<FileEntry | null> {
    const clean = normalizePath(path)
    try {
      const info = await stat(this.abs(clean))
      if (info.isDirectory) return { path: clean, kind: 'folder' }
      const mtime = info.mtime ? info.mtime.getTime() : Date.now()
      return {
        path: clean,
        kind: 'file',
        size: info.size,
        createdAt: info.birthtime ? info.birthtime.getTime() : mtime,
        modifiedAt: mtime,
      }
    } catch {
      return null
    }
  }

  async exists(path: string): Promise<boolean> {
    return fsExists(this.abs(path))
  }

  async readText(path: string): Promise<string> {
    return readTextFile(this.abs(path))
  }

  async writeText(path: string, content: string): Promise<void> {
    await mkdir(this.abs(dirname(normalizePath(path))), { recursive: true })
    await writeTextFile(this.abs(path), content)
  }

  async readBinary(path: string): Promise<Blob> {
    const bytes = await readFile(this.abs(path))
    return new Blob([bytes])
  }

  async writeBinary(path: string, data: Blob): Promise<void> {
    await mkdir(this.abs(dirname(normalizePath(path))), { recursive: true })
    await writeFile(this.abs(path), new Uint8Array(await data.arrayBuffer()))
  }

  private async copyToTrash(path: string): Promise<void> {
    const clean = normalizePath(path)
    const info = await stat(this.abs(clean)).catch(() => null)
    const isBinary = !clean.toLowerCase().endsWith('.md')
    const mtime = info?.mtime ? info.mtime.getTime() : Date.now()
    await db.trash.add({
      id: generateId(),
      vaultId: this.vaultId,
      originalPath: clean,
      deletedAt: Date.now(),
      isBinary,
      text: isBinary ? undefined : await this.readText(clean),
      blob: isBinary ? await this.readBinary(clean) : undefined,
      size: info?.size ?? 0,
      createdAt: info?.birthtime ? info.birthtime.getTime() : mtime,
      modifiedAt: mtime,
    })
  }

  async deleteFile(path: string): Promise<void> {
    const clean = normalizePath(path)
    await this.copyToTrash(clean)
    await remove(this.abs(clean))
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const from = normalizePath(oldPath)
    const to = normalizePath(newPath)
    if (from === to) return
    if (await this.exists(to)) throw new AlreadyExistsError(newPath)
    await mkdir(this.abs(dirname(to)), { recursive: true })
    await rename(this.abs(from), this.abs(to))
  }

  async createFolder(path: string): Promise<void> {
    await mkdir(this.abs(path), { recursive: true })
  }

  async deleteFolder(path: string): Promise<void> {
    const clean = normalizePath(path)
    for (const entry of await this.list()) {
      if (entry.kind === 'file' && isWithin(clean, entry.path)) {
        await this.copyToTrash(entry.path)
      }
    }
    await remove(this.abs(clean), { recursive: true })
  }

  async renameFolder(oldPath: string, newPath: string): Promise<void> {
    const from = normalizePath(oldPath)
    const to = normalizePath(newPath)
    if (from === to) return
    if (await this.exists(to)) throw new AlreadyExistsError(newPath)
    await mkdir(this.abs(dirname(to)), { recursive: true })
    await rename(this.abs(from), this.abs(to))
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
    this.root = ''
  }
}
