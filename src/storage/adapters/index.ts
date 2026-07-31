// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Adapter façade. New storage mechanisms (e.g. OPFS) plug in here by
 * implementing the StorageAdapter interface from `@/types` and adding a case
 * to `createAdapter` in VaultManager.
 */
export type { StorageAdapter } from '@/types'
export { BrowserVaultAdapter } from '../browser-vault/BrowserVaultAdapter'
export { LocalFolderAdapter, supportsLocalFolders } from '../local-folder/LocalFolderAdapter'
export { createAdapter } from '../VaultManager'
