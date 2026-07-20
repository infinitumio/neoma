// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Ambient declarations for the File System Access API surface neoma uses.
 * Kept minimal: only what the local-folder adapter needs, since TypeScript's
 * DOM lib does not yet ship the picker or permission methods everywhere.
 */

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}

interface FileSystemHandle {
  queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}

interface FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>
  values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>
  keys(): AsyncIterableIterator<string>
}

interface Window {
  showDirectoryPicker?(options?: {
    id?: string
    mode?: 'read' | 'readwrite'
    startIn?: string
  }): Promise<FileSystemDirectoryHandle>
}
