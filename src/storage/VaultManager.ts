// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Vault registry: creating, listing, opening and removing vaults of every
 * kind. Returns StorageAdapter instances — the rest of the app never knows
 * which storage mechanism backs the current vault.
 */
import type { StorageAdapter, Vault } from '@/types'
import { db } from './db'
import { BrowserVaultAdapter } from './browser-vault/BrowserVaultAdapter'
import {
  LocalFolderAdapter,
  supportsLocalFolders,
  verifyHandlePermission,
} from './local-folder/LocalFolderAdapter'
import { TauriFsAdapter } from './tauri-fs/TauriFsAdapter'
import { isDesktopApp } from '@/desktop/tauri'
import { createBookmark } from '@/desktop/bookmarks'
import { generateId } from '@/utils/misc'

/**
 * True where a real folder on disk can back a vault. Two mechanisms qualify:
 * Chromium browsers (File System Access API) and the desktop app (Tauri's
 * native picker).
 *
 * The phone app has neither. WKWebView ships no File System Access API, and
 * tauri-plugin-dialog's folder picker is compiled desktop-only — on mobile it
 * returns `FolderPickerNotImplemented` rather than opening anything. Callers
 * must gate the "open a folder" affordance on this, because an action that is
 * offered and then fails is an App Store review rejection (Guideline 2.1).
 */
export function supportsFolderVaults(): boolean {
  return supportsLocalFolders() || isDesktopApp()
}

/**
 * Open a folder as a vault using whichever picker this platform has. Returns
 * null if the user cancels. Throws if the platform has no picker at all —
 * check `supportsFolderVaults()` before offering this.
 */
export async function openFolderVault(): Promise<Vault | null> {
  return isDesktopApp() ? openTauriFolderVault() : openLocalFolderVault()
}

export async function listVaults(): Promise<Vault[]> {
  const vaults = await db.vaults.toArray()
  return vaults.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
}

export async function createBrowserVault(name: string): Promise<Vault> {
  const vault: Vault = {
    id: generateId(),
    name: name.trim() || 'My vault',
    kind: 'browser',
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
  }
  await db.vaults.add(vault)
  return vault
}

/**
 * Ask the user to pick a local folder (requires a user gesture) and register
 * it as a vault. Returns null if the user cancels the picker.
 */
export async function openLocalFolderVault(): Promise<Vault | null> {
  if (!supportsLocalFolders()) {
    throw new Error('This browser does not support opening local folders')
  }
  let handle: FileSystemDirectoryHandle
  try {
    handle = await window.showDirectoryPicker!({ id: 'neoma-vault', mode: 'readwrite' })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null
    throw err
  }
  if (!(await verifyHandlePermission(handle, true))) return null

  // Re-use the existing vault if this folder was opened before.
  for (const record of await db.handles.toArray()) {
    try {
      if (await record.handle.isSameEntry(handle)) {
        const existing = await db.vaults.get(record.vaultId)
        if (existing) {
          await db.handles.put({ vaultId: record.vaultId, handle })
          return existing
        }
      }
    } catch {
      // Stale handle; ignore.
    }
  }

  const vault: Vault = {
    id: generateId(),
    name: handle.name,
    kind: 'local-folder',
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
  }
  await db.vaults.add(vault)
  await db.handles.put({ vaultId: vault.id, handle })
  return vault
}

/**
 * Open a real folder as a vault in the desktop app, using the native folder
 * picker and Tauri's filesystem (the webview has no File System Access API).
 * Returns null if the user cancels. Desktop only.
 */
export async function openTauriFolderVault(): Promise<Vault | null> {
  if (!isDesktopApp()) throw new Error('Native folders are only available in the desktop app')
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Open a folder as a Neoma vault',
  })
  if (!selected || typeof selected !== 'string') return null
  const rootPath = selected.replace(/\/+$/, '')

  // Mint the bookmark now, while the picker's grant is still live — it cannot be
  // created later from a bare path. Null off the Mac App Store build, which is
  // fine: only the sandbox needs it. See src/desktop/bookmarks.ts.
  const rootBookmark = (await createBookmark(rootPath)) ?? undefined

  // Re-use the existing vault if this folder was opened before, refreshing its
  // bookmark — a re-pick is the natural moment to replace a stale one.
  const existing = (await db.vaults.toArray()).find(
    (v) => v.kind === 'tauri-fs' && v.rootPath === rootPath,
  )
  if (existing) {
    if (rootBookmark && rootBookmark !== existing.rootBookmark) {
      await db.vaults.update(existing.id, { rootBookmark })
      return { ...existing, rootBookmark }
    }
    return existing
  }

  const vault: Vault = {
    id: generateId(),
    name: rootPath.split('/').pop() || 'Vault',
    kind: 'tauri-fs',
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
    rootPath,
    rootBookmark,
  }
  await db.vaults.add(vault)
  return vault
}

export function createAdapter(vault: Vault): StorageAdapter {
  if (vault.kind === 'browser') return new BrowserVaultAdapter(vault.id)
  if (vault.kind === 'tauri-fs') return new TauriFsAdapter(vault.id)
  return new LocalFolderAdapter(vault.id)
}

export async function touchVault(id: string): Promise<void> {
  await db.vaults.update(id, { lastOpenedAt: Date.now() })
}

export async function renameVault(id: string, name: string): Promise<void> {
  await db.vaults.update(id, { name })
}

/**
 * Remove a vault. Browser vaults have their data destroyed (after the UI has
 * confirmed with the user); local-folder vaults only forget the handle — the
 * folder on disk is never touched.
 */
export async function removeVault(vault: Vault): Promise<void> {
  if (vault.kind === 'browser') {
    await BrowserVaultAdapter.destroy(vault.id)
  }
  await db.handles.delete(vault.id)
  await db.trash.where('vaultId').equals(vault.id).delete()
  await db.vaults.delete(vault.id)
}
