// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Core domain types shared across neoma.
 *
 * Paths are always vault-relative, use `/` separators, and never start with
 * `/`. Markdown files (`.md`) are notes; everything else is an attachment.
 */

export type VaultKind = 'browser' | 'local-folder'

export interface Vault {
  id: string
  name: string
  kind: VaultKind
  createdAt: number
  lastOpenedAt: number
}

export interface FileEntry {
  path: string
  kind: 'file' | 'folder'
  size?: number
  createdAt?: number
  modifiedAt?: number
}

export interface TrashEntry {
  id: string
  vaultId: string
  originalPath: string
  deletedAt: number
  isBinary: boolean
  size: number
}

export interface Heading {
  depth: number
  text: string
  /** slug used for `#heading` anchors */
  slug: string
  /** character offset of the heading line in the note body */
  offset: number
}

export interface WikiLink {
  /** raw target as written, e.g. `Note Name#Heading` */
  raw: string
  /** target note name/path without heading or alias */
  target: string
  heading?: string
  alias?: string
  /** character offset in the note text */
  offset: number
  /** true for standard markdown links to local .md files */
  isMarkdownLink?: boolean
}

/** Metadata extracted from a note without keeping its full text on hand. */
export interface NoteMeta {
  path: string
  /** file name without extension */
  name: string
  /** display title: frontmatter `title` if present, else the file name */
  title: string
  frontmatter: Record<string, unknown>
  aliases: string[]
  tags: string[]
  links: WikiLink[]
  headings: Heading[]
  citations: string[]
  wordCount: number
  charCount: number
  createdAt: number
  modifiedAt: number
}

export interface Note extends NoteMeta {
  content: string
}

export interface Folder {
  path: string
  name: string
}

export interface Attachment {
  path: string
  name: string
  size?: number
  modifiedAt?: number
}

/**
 * Storage abstraction. The UI never talks to IndexedDB or the File System
 * Access API directly — every file operation goes through an adapter.
 */
export interface StorageAdapter {
  readonly kind: VaultKind
  readonly vaultId: string
  /** Prepare the adapter (open DB, verify permissions). */
  init(): Promise<void>
  /** List every file and folder in the vault. */
  list(): Promise<FileEntry[]>
  stat(path: string): Promise<FileEntry | null>
  exists(path: string): Promise<boolean>
  readText(path: string): Promise<string>
  writeText(path: string, content: string): Promise<void>
  readBinary(path: string): Promise<Blob>
  writeBinary(path: string, data: Blob): Promise<void>
  /** Move a file to the vault trash (recoverable). */
  deleteFile(path: string): Promise<void>
  /** Rename/move a file. Fails if the destination exists. */
  rename(oldPath: string, newPath: string): Promise<void>
  createFolder(path: string): Promise<void>
  /** Move a folder and all its children to trash. */
  deleteFolder(path: string): Promise<void>
  renameFolder(oldPath: string, newPath: string): Promise<void>
  listTrash(): Promise<TrashEntry[]>
  /** Restore a trashed file; returns the path it was restored to. */
  restoreFromTrash(id: string): Promise<string>
  purgeTrashItem(id: string): Promise<void>
  /** Release resources. */
  close(): void
}

export interface SearchFilters {
  folder?: string
  tag?: string
  /** frontmatter `type` */
  noteType?: string
  createdAfter?: number
  createdBefore?: number
  modifiedAfter?: number
  modifiedBefore?: number
}

export interface SearchResultItem {
  path: string
  title: string
  score: number
  /** matched excerpt with `start`/`end` highlighting offsets */
  snippets: Array<{ text: string; ranges: Array<[number, number]> }>
}

/** Contract implemented by the search index (runs in a Web Worker). */
export interface SearchIndex {
  upsert(docs: Array<{ path: string; text: string; meta: NoteMeta }>): Promise<void>
  remove(path: string): Promise<void>
  /** May resolve with re-extracted metadata for the renamed note. */
  rename(oldPath: string, newPath: string): Promise<NoteMeta[] | void>
  query(query: string, filters?: SearchFilters): Promise<SearchResultItem[]>
  /** Find plain-text mentions of any of `terms` outside wiki links. */
  mentions(terms: string[], excludePath: string): Promise<SearchResultItem[]>
  clear(): Promise<void>
}

export interface BacklinkInfo {
  sourcePath: string
  sourceTitle: string
  /** excerpt of the line containing the link */
  context: string
}

/** Contract for the link graph maintained on the main thread. */
export interface LinkIndex {
  update(meta: NoteMeta): void
  remove(path: string): void
  resolve(target: string, fromPath?: string): string | null
  outgoing(path: string): Array<{ link: WikiLink; resolved: string | null }>
  backlinks(path: string): BacklinkInfo[]
  isOrphan(path: string): boolean
  brokenLinks(path: string): WikiLink[]
}

export interface Command {
  id: string
  title: string
  /** category shown in the palette, e.g. "Notes" */
  category?: string
  /** default key binding, e.g. "Mod+K" */
  shortcut?: string
  /** whether the command is currently available */
  isAvailable?: () => boolean
  run: () => void | Promise<void>
}

export interface Template {
  id: string
  name: string
  description?: string
  /** markdown body; may contain {{title}}, {{date}}, {{time}} placeholders */
  content: string
  builtIn?: boolean
}

export interface Theme {
  id: string
  name: string
  /** CSS custom property overrides applied to :root */
  variables?: Record<string, string>
}

export type EditorMode = 'edit' | 'split' | 'reading'

export type SortOrder = 'name' | 'created' | 'modified'

export interface ApplicationSettings {
  theme: 'dark' | 'light'
  editorFontSize: number
  editorLineWidth: number
  showLineNumbers: boolean
  spellcheck: boolean
  defaultEditorMode: EditorMode
  autosaveDelayMs: number
  attachmentFolder: string
  dailyNotesFolder: string
  dailyNoteFormat: string
  dailyNoteTemplateId: string | null
  templatesFolder: string
  fileSortOrder: SortOrder
  confirmBeforeDelete: boolean
  reducedMotion: 'system' | 'reduced' | 'full'
  customShortcuts: Record<string, string>
}

export interface TabState {
  id: string
  type: 'note' | 'graph' | 'settings'
  path?: string
  pinned: boolean
}

export type SaveState = 'saved' | 'unsaved' | 'saving' | 'error'
