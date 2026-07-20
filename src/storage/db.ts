// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The single Dexie database backing browser vaults, the vault registry,
 * persisted local-folder handles and the recoverable trash. Only the storage
 * layer imports this module — UI code must go through a StorageAdapter.
 */
import Dexie, { type EntityTable } from 'dexie'
import type { Vault } from '@/types'

export interface FileRecord {
  vaultId: string
  path: string
  isBinary: boolean
  text?: string
  blob?: Blob
  size: number
  createdAt: number
  modifiedAt: number
}

export interface FolderRecord {
  vaultId: string
  path: string
}

export interface TrashRecord {
  id: string
  vaultId: string
  originalPath: string
  deletedAt: number
  isBinary: boolean
  text?: string
  blob?: Blob
  size: number
  createdAt: number
  modifiedAt: number
}

export interface HandleRecord {
  vaultId: string
  handle: FileSystemDirectoryHandle
}

class NeomaDatabase extends Dexie {
  vaults!: EntityTable<Vault, 'id'>
  files!: Dexie.Table<FileRecord, [string, string]>
  folders!: Dexie.Table<FolderRecord, [string, string]>
  trash!: EntityTable<TrashRecord, 'id'>
  handles!: EntityTable<HandleRecord, 'vaultId'>

  constructor() {
    super('neoma')
    this.version(1).stores({
      vaults: 'id, lastOpenedAt',
      files: '[vaultId+path], vaultId',
      folders: '[vaultId+path], vaultId',
      trash: 'id, vaultId, deletedAt',
      handles: 'vaultId',
    })
  }
}

export const db = new NeomaDatabase()
