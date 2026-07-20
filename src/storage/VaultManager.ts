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
import { generateId } from '@/utils/misc'

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

export function createAdapter(vault: Vault): StorageAdapter {
  return vault.kind === 'browser'
    ? new BrowserVaultAdapter(vault.id)
    : new LocalFolderAdapter(vault.id)
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
