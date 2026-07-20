// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Vault store: the orchestration layer between the UI, the storage adapter,
 * the index worker and the link graph. All note operations flow through
 * here; components never touch IndexedDB or file handles directly.
 */
import { create } from 'zustand'
import type { FileEntry, NoteMeta, SaveState, StorageAdapter, TrashEntry, Vault } from '@/types'
import { createAdapter, touchVault } from '@/storage/VaultManager'
import { LocalFolderAdapter } from '@/storage/local-folder/LocalFolderAdapter'
import { ConflictError, PermissionError } from '@/storage/errors'
import { SearchClient } from '@/search/SearchClient'
import { LinkGraph } from '@/links/LinkGraph'
import { rewriteLinks } from '@/links/rewriteLinks'
import { debounce } from '@/utils/misc'
import {
  basename,
  dirname,
  isMarkdown,
  isWithin,
  joinPath,
  sanitizeName,
  stem,
  uniquePath,
} from '@/utils/paths'
import { useSettings } from '@/settings/settingsStore'
import { useTabs } from './tabsStore'

export type VaultStatus = 'closed' | 'opening' | 'ready' | 'permission' | 'error'

export interface OpenNote {
  content: string
  saveState: SaveState
  diskModifiedAt: number
}

export interface ConflictState {
  path: string
  ourContent: string
  diskContent: string
}

export interface LinkUpdatePlan {
  oldPath: string
  newPath: string
  newName: string
  affected: Array<{ path: string; title: string; count: number }>
}

interface VaultState {
  vault: Vault | null
  status: VaultStatus
  errorMessage: string | null
  entries: Map<string, FileEntry>
  metas: Map<string, NoteMeta>
  notes: Map<string, OpenNote>
  pinned: string[]
  trash: TrashEntry[]
  indexProgress: { done: number; total: number } | null
  conflict: ConflictState | null
  linkUpdatePlan: LinkUpdatePlan | null
  /** bumped whenever metas change, so panels can recompute cheaply */
  metaVersion: number
}

// Non-serialisable singletons live at module scope, not in the store.
let adapter: StorageAdapter | null = null
let search: SearchClient | null = null
const linkGraph = new LinkGraph()
let openToken = 0
const savers = new Map<string, ReturnType<typeof debounce<[string]>>>()

export function getAdapter(): StorageAdapter | null {
  return adapter
}

export function getSearch(): SearchClient | null {
  return search
}

export function getLinkGraph(): LinkGraph {
  return linkGraph
}

function pinnedKey(vaultId: string): string {
  return `neoma.pinned.${vaultId}`
}

export const useVault = create<VaultState>(() => ({
  vault: null,
  status: 'closed',
  errorMessage: null,
  entries: new Map(),
  metas: new Map(),
  notes: new Map(),
  pinned: [],
  trash: [],
  indexProgress: null,
  conflict: null,
  linkUpdatePlan: null,
  metaVersion: 0,
}))

function setState(partial: Partial<VaultState>): void {
  useVault.setState(partial)
}

function bumpMetas(updates: NoteMeta[], removals: string[] = []): void {
  const metas = new Map(useVault.getState().metas)
  for (const meta of updates) {
    metas.set(meta.path, meta)
    linkGraph.update(meta)
  }
  for (const path of removals) {
    metas.delete(path)
    linkGraph.remove(path)
  }
  setState({ metas, metaVersion: useVault.getState().metaVersion + 1 })
}

function updateEntry(entry: FileEntry): void {
  const entries = new Map(useVault.getState().entries)
  entries.set(entry.path, entry)
  setState({ entries })
}

function removeEntries(predicate: (path: string) => boolean): void {
  const entries = new Map(useVault.getState().entries)
  for (const path of [...entries.keys()]) {
    if (predicate(path)) entries.delete(path)
  }
  setState({ entries })
}

/* ------------------------------------------------------------------ */
/* Opening and closing vaults                                          */
/* ------------------------------------------------------------------ */

export async function openVault(vault: Vault): Promise<void> {
  const token = ++openToken
  closeVaultInternals()
  setState({
    vault,
    status: 'opening',
    errorMessage: null,
    entries: new Map(),
    metas: new Map(),
    notes: new Map(),
    trash: [],
    conflict: null,
    linkUpdatePlan: null,
    indexProgress: null,
    pinned: JSON.parse(localStorage.getItem(pinnedKey(vault.id)) ?? '[]'),
  })

  localStorage.setItem('neoma.lastVault', vault.id)
  adapter = createAdapter(vault)
  search = new SearchClient()
  try {
    await adapter.init()
  } catch (err) {
    if (token !== openToken) return
    if (err instanceof PermissionError) {
      setState({ status: 'permission' })
      return
    }
    setState({ status: 'error', errorMessage: err instanceof Error ? err.message : String(err) })
    return
  }
  await touchVault(vault.id).catch(() => {})
  await loadVaultContents(token)
}

/** Continue opening a local-folder vault after the user re-grants access. */
export async function requestFolderAccess(): Promise<boolean> {
  if (!(adapter instanceof LocalFolderAdapter)) return false
  const granted = await adapter.requestAccess()
  if (granted) await loadVaultContents(++openToken)
  return granted
}

async function loadVaultContents(token: number): Promise<void> {
  if (!adapter || !search) return
  let list: FileEntry[]
  try {
    list = await adapter.list()
  } catch (err) {
    if (err instanceof PermissionError) setState({ status: 'permission' })
    else setState({ status: 'error', errorMessage: String(err) })
    return
  }
  if (token !== openToken) return
  const entries = new Map(list.map((entry) => [entry.path, entry]))
  // The editor becomes usable immediately; indexing continues behind it.
  setState({ entries, status: 'ready' })
  useTabs.getState().restoreForVault(useVault.getState().vault!.id)
  void refreshTrash()

  const mdFiles = list.filter((e) => e.kind === 'file' && isMarkdown(e.path))
  setState({ indexProgress: { done: 0, total: mdFiles.length } })
  const CHUNK = 24
  for (let i = 0; i < mdFiles.length; i += CHUNK) {
    if (token !== openToken) return
    const chunk = mdFiles.slice(i, i + CHUNK)
    const items = await Promise.all(
      chunk.map(async (entry) => ({
        path: entry.path,
        text: await adapter!.readText(entry.path).catch(() => ''),
        createdAt: entry.createdAt ?? Date.now(),
        modifiedAt: entry.modifiedAt ?? Date.now(),
      })),
    )
    if (token !== openToken) return
    const metas = await search.upsertWithMeta(items)
    if (token !== openToken) return
    bumpMetas(metas)
    setState({
      indexProgress: { done: Math.min(i + CHUNK, mdFiles.length), total: mdFiles.length },
    })
  }
  if (token === openToken) setState({ indexProgress: null })
}

function closeVaultInternals(): void {
  for (const saver of savers.values()) saver.flush()
  savers.clear()
  adapter?.close()
  adapter = null
  search?.terminate()
  search = null
  linkGraph.clear()
}

export function closeVault(): void {
  openToken++
  localStorage.removeItem('neoma.lastVault')
  closeVaultInternals()
  useTabs.getState().clear()
  setState({
    vault: null,
    status: 'closed',
    entries: new Map(),
    metas: new Map(),
    notes: new Map(),
    trash: [],
    pinned: [],
    indexProgress: null,
    conflict: null,
    linkUpdatePlan: null,
  })
}

/* ------------------------------------------------------------------ */
/* Reading, editing and saving notes                                   */
/* ------------------------------------------------------------------ */

export async function loadNote(path: string): Promise<OpenNote | null> {
  const cached = useVault.getState().notes.get(path)
  if (cached) return cached
  if (!adapter) return null
  try {
    const [content, statEntry] = await Promise.all([adapter.readText(path), adapter.stat(path)])
    const note: OpenNote = {
      content,
      saveState: 'saved',
      diskModifiedAt: statEntry?.modifiedAt ?? Date.now(),
    }
    const notes = new Map(useVault.getState().notes)
    notes.set(path, note)
    setState({ notes })
    return note
  } catch {
    return null
  }
}

function setNote(path: string, patch: Partial<OpenNote>): void {
  const notes = new Map(useVault.getState().notes)
  const existing = notes.get(path)
  if (!existing) return
  notes.set(path, { ...existing, ...patch })
  setState({ notes })
}

/** Called by the editor on every keystroke (already CM-debounced lightly). */
export function updateNoteContent(path: string, content: string): void {
  const note = useVault.getState().notes.get(path)
  if (!note || note.content === content) return
  setNote(path, { content, saveState: 'unsaved' })
  let saver = savers.get(path)
  if (!saver) {
    saver = debounce(
      (p: string) => void performSave(p),
      useSettings.getState().settings.autosaveDelayMs,
    )
    savers.set(path, saver)
  }
  saver(path)
}

export async function saveNoteNow(path: string): Promise<void> {
  savers.get(path)?.cancel()
  await performSave(path)
}

export function flushAllSaves(): void {
  for (const saver of savers.values()) saver.flush()
}

async function performSave(path: string): Promise<void> {
  const state = useVault.getState()
  const note = state.notes.get(path)
  if (!adapter || !search || !note || note.saveState === 'saved') return
  setNote(path, { saveState: 'saving' })
  try {
    // Conflict detection: only meaningful for on-disk vaults where another
    // program can modify the file underneath us.
    if (adapter.kind === 'local-folder') {
      const disk = await adapter.stat(path)
      if (disk && disk.modifiedAt && disk.modifiedAt > note.diskModifiedAt + 1500) {
        const diskContent = await adapter.readText(path)
        if (diskContent !== note.content) {
          throw new ConflictError(path, diskContent)
        }
      }
    }
    await adapter.writeText(path, note.content)
    const statEntry = await adapter.stat(path)
    setNote(path, { saveState: 'saved', diskModifiedAt: statEntry?.modifiedAt ?? Date.now() })
    updateEntry(
      statEntry ?? { path, kind: 'file', size: note.content.length, modifiedAt: Date.now() },
    )
    const meta = useVault.getState().metas.get(path)
    const metas = await search.upsertWithMeta([
      {
        path,
        text: note.content,
        createdAt: meta?.createdAt ?? statEntry?.createdAt ?? Date.now(),
        modifiedAt: statEntry?.modifiedAt ?? Date.now(),
      },
    ])
    bumpMetas(metas)
  } catch (err) {
    if (err instanceof ConflictError) {
      setNote(path, { saveState: 'unsaved' })
      setState({ conflict: { path, ourContent: note.content, diskContent: err.diskContent } })
      return
    }
    setNote(path, { saveState: 'error' })
    if (err instanceof PermissionError) setState({ status: 'permission' })
    throw err
  }
}

export async function resolveConflict(choice: 'keep-mine' | 'use-disk'): Promise<void> {
  const conflict = useVault.getState().conflict
  if (!conflict || !adapter) return
  setState({ conflict: null })
  if (choice === 'use-disk') {
    setNote(conflict.path, { content: conflict.diskContent, saveState: 'saved' })
    const statEntry = await adapter.stat(conflict.path)
    setNote(conflict.path, { diskModifiedAt: statEntry?.modifiedAt ?? Date.now() })
  } else {
    // Take ownership: refresh our baseline mtime, then force the write.
    const statEntry = await adapter.stat(conflict.path)
    setNote(conflict.path, {
      saveState: 'unsaved',
      diskModifiedAt: statEntry?.modifiedAt ?? Date.now(),
    })
    await performSave(conflict.path)
  }
}

/* ------------------------------------------------------------------ */
/* Creating, renaming, deleting                                        */
/* ------------------------------------------------------------------ */

export async function createNote(
  folder = '',
  name = 'Untitled',
  content = '',
): Promise<string | null> {
  if (!adapter || !search) return null
  const state = useVault.getState()
  const path = uniquePath(joinPath(folder, `${sanitizeName(name)}.md`), (p) => state.entries.has(p))
  await adapter.writeText(path, content)
  const statEntry = await adapter.stat(path)
  updateEntry(statEntry ?? { path, kind: 'file', size: content.length, modifiedAt: Date.now() })
  const metas = await search.upsertWithMeta([
    {
      path,
      text: content,
      createdAt: statEntry?.createdAt ?? Date.now(),
      modifiedAt: statEntry?.modifiedAt ?? Date.now(),
    },
  ])
  bumpMetas(metas)
  const notes = new Map(useVault.getState().notes)
  notes.set(path, {
    content,
    saveState: 'saved',
    diskModifiedAt: statEntry?.modifiedAt ?? Date.now(),
  })
  setState({ notes })
  return path
}

export async function createFolder(parent: string, name: string): Promise<string | null> {
  if (!adapter) return null
  const path = joinPath(parent, sanitizeName(name))
  await adapter.createFolder(path)
  updateEntry({ path, kind: 'folder' })
  return path
}

export async function deleteNote(path: string): Promise<void> {
  if (!adapter || !search) return
  savers.get(path)?.cancel()
  savers.delete(path)
  await adapter.deleteFile(path)
  removeEntries((p) => p === path)
  await search.remove(path)
  bumpMetas([], [path])
  const notes = new Map(useVault.getState().notes)
  notes.delete(path)
  setState({ notes })
  useTabs.getState().handleDelete(path)
  void refreshTrash()
}

export async function deleteFolder(path: string): Promise<void> {
  if (!adapter || !search) return
  const affected = [...useVault.getState().entries.keys()].filter(
    (p) => p !== path && isWithin(path, p),
  )
  await adapter.deleteFolder(path)
  removeEntries((p) => p === path || isWithin(path, p))
  for (const p of affected) {
    if (!isMarkdown(p)) continue
    await search.remove(p)
    bumpMetas([], [p])
    useTabs.getState().handleDelete(p)
  }
  void refreshTrash()
}

async function moveFileInternal(oldPath: string, newPath: string): Promise<void> {
  if (!adapter || !search) return
  await saveNoteNow(oldPath).catch(() => {})
  await adapter.rename(oldPath, newPath)
  removeEntries((p) => p === oldPath)
  const statEntry = await adapter.stat(newPath)
  updateEntry(statEntry ?? { path: newPath, kind: 'file' })
  if (isMarkdown(oldPath)) {
    const metas = (await search.rename(oldPath, newPath)) as NoteMeta[] | undefined
    bumpMetas(metas ?? [], [oldPath])
    const notes = new Map(useVault.getState().notes)
    const open = notes.get(oldPath)
    if (open) {
      notes.delete(oldPath)
      notes.set(newPath, open)
      setState({ notes })
    }
    useTabs.getState().handleRename(oldPath, newPath)
    const pinned = useVault.getState().pinned
    if (pinned.includes(oldPath)) {
      setPinned(pinned.map((p) => (p === oldPath ? newPath : p)))
    }
  }
}

/**
 * Rename a note. Returns a plan describing which other notes contain links
 * to it — the caller shows this to the user and then either applies or skips
 * the link updates. Nothing is rewritten silently.
 */
export async function renameNote(oldPath: string, newName: string): Promise<LinkUpdatePlan | null> {
  const state = useVault.getState()
  const clean = sanitizeName(newName)
  const newPath = joinPath(dirname(oldPath), `${clean}.md`)
  if (newPath === oldPath) return null
  if (state.entries.has(newPath)) throw new Error(`A note called "${clean}" already exists here`)

  const meta = state.metas.get(oldPath)
  const sources = linkGraph.linkingSources(oldPath)
  await moveFileInternal(oldPath, newPath)

  if (!sources.length || !meta) return null
  const plan: LinkUpdatePlan = {
    oldPath,
    newPath,
    newName: clean,
    affected: sources.map(({ meta: m, links }) => ({
      path: m.path === oldPath ? newPath : m.path,
      title: m.title,
      count: links.length,
    })),
  }
  setState({ linkUpdatePlan: plan })
  return plan
}

/** Apply the link rewrites described by the current plan. */
export async function applyLinkUpdates(plan: LinkUpdatePlan): Promise<number> {
  if (!adapter || !search) return 0
  const oldMeta = linkGraph.get(plan.newPath)
  const oldName = stem(plan.oldPath)
  const targets = new Set<string>([
    oldName.toLowerCase(),
    plan.oldPath.replace(/\.md$/i, '').toLowerCase(),
  ])
  if (oldMeta) {
    targets.add(oldMeta.title.toLowerCase())
    for (const alias of oldMeta.aliases) targets.add(alias.toLowerCase())
  }
  let total = 0
  for (const affected of plan.affected) {
    try {
      const text = await adapter.readText(affected.path)
      const { text: rewritten, count } = rewriteLinks(text, targets, plan.newName)
      if (!count) continue
      await adapter.writeText(affected.path, rewritten)
      total += count
      const statEntry = await adapter.stat(affected.path)
      const open = useVault.getState().notes.get(affected.path)
      if (open) setNote(affected.path, { content: rewritten, saveState: 'saved' })
      const prev = useVault.getState().metas.get(affected.path)
      const metas = await search.upsertWithMeta([
        {
          path: affected.path,
          text: rewritten,
          createdAt: prev?.createdAt ?? Date.now(),
          modifiedAt: statEntry?.modifiedAt ?? Date.now(),
        },
      ])
      bumpMetas(metas)
    } catch {
      // Leave the note untouched on failure; the link simply stays broken.
    }
  }
  setState({ linkUpdatePlan: null })
  return total
}

export function dismissLinkUpdatePlan(): void {
  setState({ linkUpdatePlan: null })
}

export async function moveNote(path: string, targetFolder: string): Promise<void> {
  const state = useVault.getState()
  const newPath = uniquePath(joinPath(targetFolder, basename(path)), (p) => state.entries.has(p))
  if (newPath === path) return
  await moveFileInternal(path, newPath)
}

export async function duplicateNote(path: string): Promise<string | null> {
  if (!adapter) return null
  const content = await adapter.readText(path)
  return createNote(dirname(path), `${stem(path)} copy`, content)
}

export async function renameFolder(oldPath: string, newName: string): Promise<void> {
  if (!adapter || !search) return
  const newPath = joinPath(dirname(oldPath), sanitizeName(newName))
  if (newPath === oldPath) return
  flushAllSaves()
  await adapter.renameFolder(oldPath, newPath)
  // Simplest correct behaviour: re-list and re-index affected notes.
  const affected = [...useVault.getState().entries.keys()].filter((p) => isWithin(oldPath, p))
  removeEntries((p) => isWithin(oldPath, p))
  for (const p of affected) {
    if (isMarkdown(p)) {
      await search.remove(p)
      bumpMetas([], [p])
      useTabs.getState().handleRename(p, newPath + p.slice(oldPath.length))
    }
  }
  const list = await adapter.list()
  const entries = new Map(list.map((entry) => [entry.path, entry]))
  setState({ entries, notes: new Map() })
  const moved = list.filter(
    (e) => e.kind === 'file' && isMarkdown(e.path) && isWithin(newPath, e.path),
  )
  for (const entry of moved) {
    const text = await adapter.readText(entry.path).catch(() => '')
    const metas = await search.upsertWithMeta([
      {
        path: entry.path,
        text,
        createdAt: entry.createdAt ?? Date.now(),
        modifiedAt: entry.modifiedAt ?? Date.now(),
      },
    ])
    bumpMetas(metas)
  }
}

/* ------------------------------------------------------------------ */
/* Pins, trash, attachments                                            */
/* ------------------------------------------------------------------ */

function setPinned(pinned: string[]): void {
  const vault = useVault.getState().vault
  if (vault) localStorage.setItem(pinnedKey(vault.id), JSON.stringify(pinned))
  setState({ pinned })
}

export function togglePin(path: string): void {
  const pinned = useVault.getState().pinned
  setPinned(pinned.includes(path) ? pinned.filter((p) => p !== path) : [...pinned, path])
}

export async function refreshTrash(): Promise<void> {
  if (!adapter) return
  setState({ trash: await adapter.listTrash() })
}

export async function restoreFromTrash(id: string): Promise<string | null> {
  if (!adapter || !search) return null
  const restoredPath = await adapter.restoreFromTrash(id)
  const statEntry = await adapter.stat(restoredPath)
  updateEntry(statEntry ?? { path: restoredPath, kind: 'file' })
  if (isMarkdown(restoredPath)) {
    const text = await adapter.readText(restoredPath)
    const metas = await search.upsertWithMeta([
      {
        path: restoredPath,
        text,
        createdAt: statEntry?.createdAt ?? Date.now(),
        modifiedAt: statEntry?.modifiedAt ?? Date.now(),
      },
    ])
    bumpMetas(metas)
  }
  void refreshTrash()
  return restoredPath
}

export async function purgeTrashItem(id: string): Promise<void> {
  if (!adapter) return
  await adapter.purgeTrashItem(id)
  void refreshTrash()
}

/** Save a pasted/dropped attachment; returns its vault path. */
export async function saveAttachment(file: Blob, preferredName: string): Promise<string | null> {
  if (!adapter) return null
  const folder = useSettings.getState().settings.attachmentFolder
  const state = useVault.getState()
  const path = uniquePath(
    joinPath(folder, sanitizeName(stem(preferredName)) + extOf(preferredName)),
    (p) => state.entries.has(p),
  )
  await adapter.writeBinary(path, file)
  const statEntry = await adapter.stat(path)
  updateEntry(statEntry ?? { path, kind: 'file', size: file.size, modifiedAt: Date.now() })
  return path
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i === -1 ? '' : name.slice(i)
}

export async function renameAttachment(oldPath: string, newName: string): Promise<void> {
  if (!adapter) return
  const newPath = joinPath(dirname(oldPath), sanitizeName(stem(newName)) + extOf(newName))
  if (newPath === oldPath) return
  await adapter.rename(oldPath, newPath)
  removeEntries((p) => p === oldPath)
  const statEntry = await adapter.stat(newPath)
  updateEntry(statEntry ?? { path: newPath, kind: 'file' })
}

/** Re-list files from the adapter (used after imports). */
export async function refreshEntries(): Promise<void> {
  if (!adapter || !search) return
  const list = await adapter.list()
  const entries = new Map(list.map((entry) => [entry.path, entry]))
  setState({ entries })
  const known = useVault.getState().metas
  for (const entry of list) {
    if (entry.kind !== 'file' || !isMarkdown(entry.path)) continue
    const existing = known.get(entry.path)
    if (existing && existing.modifiedAt === entry.modifiedAt) continue
    const text = await adapter.readText(entry.path).catch(() => '')
    const metas = await search.upsertWithMeta([
      {
        path: entry.path,
        text,
        createdAt: entry.createdAt ?? Date.now(),
        modifiedAt: entry.modifiedAt ?? Date.now(),
      },
    ])
    bumpMetas(metas)
  }
}
