// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The page tree: collapsible pages and subpages (folder-note convention),
 * context menus, pinning, and drag-and-drop organisation — drop a page onto
 * a folder to move it, or onto another page to nest it as a subpage.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  ChevronRight,
  FileText,
  Paperclip,
  Pin,
  Folder as FolderIcon,
  Copy,
  Pencil,
  Trash2,
  FolderInput,
  ExternalLink,
  FilePlus2,
  ArrowUpToLine,
  Palette,
  Lock,
  Home,
} from 'lucide-react'
import type { FileEntry } from '@/types'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { ColorPicker } from './ColorPicker'
import type { PageColor } from '@/utils/colors'
import {
  useVault,
  deleteNote,
  restoreFromTrash,
  deleteFolder,
  duplicateNote,
  moveNote,
  renamePage,
  renameFolder,
  togglePin,
  renameAttachment,
  getAdapter,
  createSubpage,
  nestUnder,
  convertToTopLevel,
  getEntryColor,
  setEntryColor,
  refreshEntries,
} from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { useUi } from '@/app/uiStore'
import { useSettings } from '@/settings/settingsStore'
import { basename, dirname, folderNoteOf, isMarkdown, isPdf, isWithin, joinPath, stem } from '@/utils/paths'
import { isReservedCalendarFolder } from '@/templates/dailyNotes'
import { loadOrder, saveFolderOrder } from '@/app/fileOrder'
import { Modal } from './Modal'
import { downloadBlob, importFiles } from '@/storage/import-export'

export interface TreeNode {
  entry: FileEntry
  children: TreeNode[]
}

export function buildTree(
  entries: Map<string, FileEntry>,
  sort: string,
  order: Record<string, string[]> = {},
): TreeNode[] {
  const byFolder = new Map<string, TreeNode[]>()
  const nodes = new Map<string, TreeNode>()
  for (const entry of entries.values()) {
    const node: TreeNode = { entry, children: [] }
    nodes.set(entry.path, node)
    const parent = dirname(entry.path)
    if (!byFolder.has(parent)) byFolder.set(parent, [])
    byFolder.get(parent)!.push(node)
  }
  const compare = (a: TreeNode, b: TreeNode): number => {
    if (a.entry.kind !== b.entry.kind) return a.entry.kind === 'folder' ? -1 : 1
    if (sort === 'created') return (b.entry.createdAt ?? 0) - (a.entry.createdAt ?? 0)
    if (sort === 'modified') return (b.entry.modifiedAt ?? 0) - (a.entry.modifiedAt ?? 0)
    return basename(a.entry.path).localeCompare(basename(b.entry.path), undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  }
  for (const [folder, children] of byFolder) {
    children.sort(compare)
    // Apply a manual drag-order for this folder: listed items first (in order),
    // the rest keep the default sort after them.
    const manual = order[folder]
    if (manual?.length) {
      const rank = new Map(manual.map((p, i) => [p, i]))
      children.sort((a, b) => {
        const ra = rank.get(a.entry.path)
        const rb = rank.get(b.entry.path)
        if (ra !== undefined && rb !== undefined) return ra - rb
        if (ra !== undefined) return -1
        if (rb !== undefined) return 1
        return 0 // both unranked: keep prior (name) order
      })
    }
    const parentNode = nodes.get(folder)
    if (parentNode) parentNode.children = children
  }
  // A PDF with a sibling folder of the same name (e.g. `Lecture.pdf` +
  // `Lecture/`) adopts that folder's contents as its children — so companion
  // notes nest under the PDF without moving the file (references stay valid).
  for (const node of nodes.values()) {
    if (node.entry.kind !== 'folder') continue
    const dir = dirname(node.entry.path)
    const name = basename(node.entry.path)
    const siblings = byFolder.get(dir)
    if (!siblings) continue
    const pdfNode = siblings.find(
      (n) => n.entry.kind === 'file' && isPdf(n.entry.path) && stem(n.entry.path) === name,
    )
    if (!pdfNode) continue
    pdfNode.children = node.children
    const idx = siblings.indexOf(node)
    if (idx >= 0) siblings.splice(idx, 1)
  }
  // Root children were already sorted (name/manual) in the loop above; don't
  // re-sort here or the manual order would be lost.
  return byFolder.get('') ?? []
}

interface MenuState {
  x: number
  y: number
  entry: FileEntry
}

export function FileTree() {
  const entries = useVault((s) => s.entries)
  const pinned = useVault((s) => s.pinned)
  const vaultId = useVault((s) => s.vault?.id)
  const sortOrder = useSettings((s) => s.settings.fileSortOrder)
  const activeTab = useTabs((s) => s.tabs.find((t) => t.id === s.activeId))
  const openNote = useTabs((s) => s.openNote)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [colorFor, setColorFor] = useState<{ x: number; y: number; path: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [anchor, setAnchor] = useState<string | null>(null)
  const [movePaths, setMovePaths] = useState<string[] | null>(null)
  const [order, setOrder] = useState<Record<string, string[]>>(() => loadOrder(vaultId))
  // { path, before } — the row a dragged item would be inserted before/after.
  const [dropLine, setDropLine] = useState<{ path: string; before: boolean } | null>(null)
  const ui = useUi()

  useEffect(() => setOrder(loadOrder(vaultId)), [vaultId])

  const tree = useMemo(() => buildTree(entries, sortOrder, order), [entries, sortOrder, order])

  // Flat list of visible paths in render order, for shift-range selection.
  const flatVisible = useMemo(() => {
    const out: string[] = []
    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        out.push(node.entry.path)
        const index = folderNoteOf(node.entry.path)
        const isPage = node.entry.kind === 'folder' && entries.has(index)
        const kids = isPage
          ? node.children.filter((c) => c.entry.path !== index)
          : node.children
        const expandable = node.entry.kind === 'folder' || kids.length > 0
        if (expandable && !collapsed.has(node.entry.path)) walk(kids)
      }
    }
    walk(tree)
    return out
  }, [tree, collapsed, entries])
  const pinnedEntries = useMemo(
    () => pinned.map((p) => entries.get(p)).filter((e): e is FileEntry => !!e),
    [pinned, entries],
  )

  const toggleFolder = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  /** The index note when a folder represents a page, else null. */
  const indexNoteOf = (folderPath: string): string | null => {
    const candidate = folderNoteOf(folderPath)
    return entries.has(candidate) ? candidate : null
  }

  const openEntry = (entry: FileEntry, e?: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => {
    // Modifier-clicks build a multi-selection instead of opening.
    if (e && (e.metaKey || e.ctrlKey)) {
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(entry.path)) next.delete(entry.path)
        else next.add(entry.path)
        return next
      })
      setAnchor(entry.path)
      return
    }
    if (e?.shiftKey && anchor) {
      const a = flatVisible.indexOf(anchor)
      const b = flatVisible.indexOf(entry.path)
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a]
        setSelected(new Set(flatVisible.slice(lo, hi + 1)))
        return
      }
    }
    // Plain click: clear any multi-selection and open.
    setSelected(new Set())
    setAnchor(entry.path)
    if (entry.kind === 'folder') {
      const indexNote = indexNoteOf(entry.path)
      if (indexNote) openNote(indexNote)
      else toggleFolder(entry.path)
    } else if (isMarkdown(entry.path)) openNote(entry.path)
    else if (isPdf(entry.path)) useTabs.getState().openPdf(entry.path)
    else void openAttachment(entry.path)
  }

  /** Delete every selected entry after one confirmation. */
  const deleteSelected = (paths: string[]) => {
    const run = async () => {
      for (const p of paths) {
        const entry = entries.get(p)
        if (!entry) continue
        if (entry.kind === 'folder') await deleteFolder(p)
        else await deleteNote(p)
      }
      setSelected(new Set())
      ui.toast(`Moved ${paths.length} items to Recently deleted`, 'success')
    }
    if (!useSettings.getState().settings.confirmBeforeDelete) return void run()
    ui.askConfirm({
      title: `Delete ${paths.length} items?`,
      message: `Delete the ${paths.length} selected items? They can be restored from Recently deleted.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: run,
    })
  }

  /** Move every selected note into a chosen folder. */
  const moveSelected = (paths: string[]) => {
    askMove({ path: paths[0], kind: 'file' }, paths)
  }

  /** Duplicate every selected note (copy). */
  const duplicateSelected = async (paths: string[]) => {
    for (const p of paths) if (isMarkdown(p)) await duplicateNote(p)
    setSelected(new Set())
    ui.toast(`Duplicated ${paths.filter(isMarkdown).length} notes`, 'success')
  }

  const askNewSubpage = (notePath: string) => {
    ui.askPrompt({
      title: 'New subpage',
      label: `Subpage of "${stem(notePath)}"`,
      placeholder: 'Subpage title',
      confirmLabel: 'Create',
      onSubmit: async (value) => {
        const created = await createSubpage(notePath, value.trim() || 'Untitled')
        if (created) {
          openNote(created)
          ui.toast(`Subpage created: ${stem(created)}`, 'success')
        }
      },
    })
  }

  const askRename = (entry: FileEntry, asPage?: string) => {
    const target = asPage ?? entry.path
    ui.askPrompt({
      title: entry.kind === 'folder' && !asPage ? 'Rename folder' : 'Rename page',
      label: 'New name',
      initial: asPage || entry.kind !== 'folder' ? stem(target) : basename(entry.path),
      onSubmit: async (value) => {
        try {
          if (asPage) await renamePage(asPage, value)
          else if (entry.kind === 'folder') await renameFolder(entry.path, value)
          else if (isMarkdown(entry.path)) await renamePage(entry.path, value)
          else await renameAttachment(entry.path, value + '.' + entry.path.split('.').pop())
          ui.toast('Renamed', 'success')
        } catch (err) {
          ui.toast(err instanceof Error ? err.message : 'Rename failed', 'error')
        }
      },
    })
  }

  // Open the interactive folder picker to move one or more items.
  const askMove = (entry: FileEntry, paths?: string[]) => {
    setMovePaths(paths ?? [entry.path])
  }

  const doMove = async (targets: string[], folder: string) => {
    try {
      for (const p of targets) if (dirname(p) !== folder) await moveNote(p, folder)
      setSelected(new Set())
      setMovePaths(null)
      ui.toast(targets.length > 1 ? `Moved ${targets.length} items` : 'Page moved', 'success')
    } catch (err) {
      ui.toast(err instanceof Error ? err.message : 'Move failed', 'error')
    }
  }

  const askDelete = (entry: FileEntry) => {
    const doDelete = async () => {
      if (entry.kind === 'folder') await deleteFolder(entry.path)
      else await deleteNote(entry.path)
      const latest = useVault.getState().trash[0]
      ui.toast(
        'Moved to Recently deleted',
        'info',
        latest
          ? {
              label: 'Undo',
              run: async () => {
                const restored = await restoreFromTrash(latest.id)
                if (restored) ui.toast(`Restored ${restored}`, 'success')
              },
            }
          : undefined,
      )
    }
    if (!useSettings.getState().settings.confirmBeforeDelete) {
      void doDelete()
      return
    }
    ui.askConfirm({
      title: entry.kind === 'folder' ? 'Delete page and subpages?' : 'Delete page?',
      message:
        entry.kind === 'folder'
          ? `Delete "${entry.path}" and everything inside it? Files go to Recently deleted first.`
          : `Delete "${entry.path}"? It can be restored from Recently deleted.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: doDelete,
    })
  }

  const noteMenuItems = (path: string, folderEntry?: FileEntry): MenuItem[] => [
    {
      label: 'Open in new tab',
      icon: <ExternalLink size={14} aria-hidden />,
      onSelect: () => openNote(path, { newTab: true }),
    },
    {
      label: 'New subpage',
      icon: <FilePlus2 size={14} aria-hidden />,
      onSelect: () => askNewSubpage(path),
    },
    {
      label: 'Set colour…',
      icon: <Palette size={14} aria-hidden />,
      onSelect: () => setColorFor({ x: menu?.x ?? 200, y: menu?.y ?? 200, path }),
    },
    {
      label: pinned.includes(path) ? 'Unpin' : 'Pin',
      icon: <Pin size={14} aria-hidden />,
      separatorAfter: true,
      onSelect: () => togglePin(path),
    },
    {
      label: 'Rename…',
      icon: <Pencil size={14} aria-hidden />,
      onSelect: () =>
        askRename(folderEntry ?? { path, kind: 'file' }, folderEntry ? path : undefined),
    },
    {
      label: 'Move…',
      icon: <FolderInput size={14} aria-hidden />,
      onSelect: () => askMove({ path, kind: 'file' }),
    },
    ...(dirname(path)
      ? [
          {
            label: 'Convert to top-level page',
            icon: <ArrowUpToLine size={14} aria-hidden />,
            onSelect: () =>
              void convertToTopLevel(path).then(() => ui.toast('Moved to top level', 'success')),
          },
        ]
      : []),
    {
      label: 'Duplicate',
      icon: <Copy size={14} aria-hidden />,
      separatorAfter: true,
      onSelect: () => void duplicateNote(path),
    },
    {
      label: 'Delete',
      icon: <Trash2 size={14} aria-hidden />,
      danger: true,
      onSelect: () => askDelete(folderEntry ?? { path, kind: 'file' }),
    },
  ]

  const menuItems = (entry: FileEntry): MenuItem[] => {
    // A right-click on any member of a multi-selection acts on the whole set.
    if (selected.size > 1 && selected.has(entry.path)) {
      const paths = [...selected]
      return [
        {
          label: `Move ${paths.length} items…`,
          icon: <FolderInput size={14} aria-hidden />,
          onSelect: () => moveSelected(paths),
        },
        {
          label: `Duplicate ${paths.length}`,
          icon: <Copy size={14} aria-hidden />,
          onSelect: () => void duplicateSelected(paths),
        },
        {
          label: `Delete ${paths.length}`,
          icon: <Trash2 size={14} aria-hidden />,
          danger: true,
          onSelect: () => deleteSelected(paths),
        },
      ]
    }
    if (entry.kind === 'folder') {
      const indexNote = indexNoteOf(entry.path)
      // Reserved calendar folders (Calendar/ and its day folders) can't be
      // renamed, moved or deleted — only their events. Strip those actions.
      if (isReservedCalendarFolder(entry.path)) {
        if (!indexNote) return []
        return noteMenuItems(indexNote, entry).filter(
          (m) => !['Rename…', 'Move…', 'Convert to top-level page', 'Duplicate', 'Delete'].includes(
            m.label,
          ),
        )
      }
      if (indexNote) return noteMenuItems(indexNote, entry)
      return [
        {
          label: 'Rename',
          icon: <Pencil size={14} aria-hidden />,
          onSelect: () => askRename(entry),
        },
        {
          label: 'Delete',
          icon: <Trash2 size={14} aria-hidden />,
          danger: true,
          onSelect: () => askDelete(entry),
        },
      ]
    }
    if (!isMarkdown(entry.path)) {
      return [
        {
          label: 'Open',
          icon: <ExternalLink size={14} aria-hidden />,
          onSelect: () =>
            isPdf(entry.path)
              ? useTabs.getState().openPdf(entry.path)
              : void openAttachment(entry.path),
        },
        {
          label: 'Set colour…',
          icon: <Palette size={14} aria-hidden />,
          onSelect: () => setColorFor({ x: menu?.x ?? 200, y: menu?.y ?? 200, path: entry.path }),
        },
        {
          label: 'Rename',
          icon: <Pencil size={14} aria-hidden />,
          onSelect: () => askRename(entry),
        },
        {
          label: 'Delete',
          icon: <Trash2 size={14} aria-hidden />,
          danger: true,
          onSelect: () => askDelete(entry),
        },
      ]
    }
    return noteMenuItems(entry.path)
  }

  const onDropOnEntry = async (target: FileEntry, event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDropTarget(null)
    // External files dropped from the OS → import as attachments.
    if (event.dataTransfer.files.length > 0) {
      const adapter = getAdapter()
      if (!adapter) return
      const folder =
        target.kind === 'folder' ? target.path : useSettings.getState().settings.attachmentFolder
      const summary = await importFiles(adapter, [...event.dataTransfer.files], {
        attachmentsFolder: folder,
      })
      await refreshEntries()
      ui.toast(
        `Imported ${summary.attachments + summary.notes} file${
          summary.attachments + summary.notes === 1 ? '' : 's'
        }`,
        'success',
      )
      return
    }
    const sourcePath = event.dataTransfer.getData('application/x-neoma-path')
    if (!sourcePath || sourcePath === target.path) return
    // Dragging a member of a multi-selection moves the whole set.
    const sources = selected.has(sourcePath) && selected.size > 1 ? [...selected] : [sourcePath]
    try {
      if (target.kind === 'folder') {
        for (const s of sources) if (dirname(s) !== target.path) await moveNote(s, target.path)
        setSelected(new Set())
        ui.toast(sources.length > 1 ? `Moved ${sources.length} items` : 'Page moved', 'success')
      } else if (isMarkdown(target.path)) {
        for (const s of sources) await nestUnder(s, target.path)
        setSelected(new Set())
        ui.toast(`Nested under "${stem(target.path)}"`, 'success')
      }
    } catch (err) {
      ui.toast(err instanceof Error ? err.message : 'Move failed', 'error')
    }
  }

  const findNode = (nodes: TreeNode[], path: string): TreeNode | null => {
    for (const n of nodes) {
      if (n.entry.path === path) return n
      const found = findNode(n.children, path)
      if (found) return found
    }
    return null
  }

  /** Drop `sourcePath` before/after `targetPath` in that row's folder,
   *  persisting a manual order for the folder. */
  const reorder = async (sourcePath: string, targetPath: string, before: boolean) => {
    if (sourcePath === targetPath) return
    const folder = dirname(targetPath)
    let src = sourcePath
    try {
      if (dirname(src) !== folder) {
        await moveNote(src, folder)
        src = joinPath(folder, basename(src))
      }
    } catch (err) {
      ui.toast(err instanceof Error ? err.message : 'Move failed', 'error')
      return
    }
    const parent = folder === '' ? { children: tree } : findNode(tree, folder)
    const sibs = (parent?.children ?? []).map((n) => n.entry.path).filter((p) => p !== src)
    const idx = sibs.indexOf(targetPath)
    if (idx === -1) return
    const insertAt = before ? idx : idx + 1
    const next = [...sibs.slice(0, insertAt), src, ...sibs.slice(insertAt)]
    setOrder(saveFolderOrder(vaultId, folder, next))
  }

  const renderNode = (node: TreeNode) => {
    const { entry } = node
    const isFolder = entry.kind === 'folder'
    const indexNote = isFolder ? indexNoteOf(entry.path) : null
    const isPageFolder = indexNote !== null
    const isOpen = !collapsed.has(entry.path)
    const isActive =
      activeTab?.type === 'note' &&
      (activeTab.path === entry.path || (isPageFolder && activeTab.path === indexNote))
    const children = isPageFolder
      ? node.children.filter((child) => child.entry.path !== indexNote)
      : node.children
    // A non-folder node can have children too (a PDF that adopted a sibling
    // folder's notes — see buildTree).
    const expandable = isFolder || children.length > 0
    const droppable = isFolder || isMarkdown(entry.path)
    // Calendar/ and its day folders are app-managed: can't be dragged/renamed.
    const reserved = isFolder && isReservedCalendarFolder(entry.path)
    return (
      <li key={entry.path} role="treeitem" aria-expanded={expandable ? isOpen : undefined}>
        <button
          className={`tree-item${isActive ? ' active' : ''}${dropTarget === entry.path ? ' drop-target' : ''}${selected.has(entry.path) ? ' multi-selected' : ''}${
            dropLine?.path === entry.path ? (dropLine.before ? ' drop-before' : ' drop-after') : ''
          }`}
          onClick={(e) => openEntry(entry, e)}
          onContextMenu={(e) => {
            e.preventDefault()
            if (menuItems(entry).length) setMenu({ x: e.clientX, y: e.clientY, entry })
          }}
          draggable={(!isFolder || isPageFolder) && !reserved}
          onDragStart={(e) => {
            e.dataTransfer.setData(
              'application/x-neoma-path',
              isPageFolder ? indexNote! : entry.path,
            )
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            // Top/bottom edge → reorder (show a line); middle of a folder/page
            // → nest into it. Reserved date folders can still be nested into.
            const r = e.currentTarget.getBoundingClientRect()
            const rel = (e.clientY - r.top) / r.height
            if (droppable && rel > 0.28 && rel < 0.72) {
              setDropTarget(entry.path)
              setDropLine(null)
            } else {
              setDropLine({ path: entry.path, before: rel <= 0.5 })
              setDropTarget(null)
            }
          }}
          onDragLeave={() => {
            setDropTarget(null)
            setDropLine(null)
          }}
          onDrop={(e) => {
            const line = dropLine
            setDropLine(null)
            setDropTarget(null)
            const source = e.dataTransfer.getData('application/x-neoma-path')
            if (line?.path === entry.path && source && e.dataTransfer.files.length === 0) {
              e.preventDefault()
              e.stopPropagation()
              void reorder(source, entry.path, line.before)
            } else {
              void onDropOnEntry(entry, e)
            }
          }}
          title={entry.path}
        >
          {isFolder ? (
            <>
              <ChevronRight
                size={14}
                className={`tree-chevron${isOpen ? ' open' : ''}`}
                aria-hidden
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFolder(entry.path)
                }}
              />
              {isPageFolder ? (
                <FileText size={14} aria-hidden />
              ) : (
                <FolderIcon size={14} aria-hidden />
              )}
            </>
          ) : (
            <>
              {expandable ? (
                <ChevronRight
                  size={14}
                  className={`tree-chevron${isOpen ? ' open' : ''}`}
                  aria-hidden
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFolder(entry.path)
                  }}
                />
              ) : null}
              {isMarkdown(entry.path) ? (
                <FileText
                  size={14}
                  aria-hidden
                  style={{ marginLeft: expandable ? 0 : 14, flexShrink: 0 }}
                />
              ) : (
                <Paperclip
                  size={14}
                  aria-hidden
                  style={{ marginLeft: expandable ? 0 : 14, flexShrink: 0 }}
                />
              )}
            </>
          )}
          <span className="tree-label">{isFolder ? basename(entry.path) : stem(entry.path)}</span>
          {(() => {
            const color = getEntryColor(isPageFolder ? indexNote! : entry.path)
            return color ? (
              <span
                className="tree-color-dot"
                style={{ background: `var(--pc-${color})` }}
                aria-label={`Colour: ${color}`}
              />
            ) : null
          })()}
          {pinned.includes(isPageFolder ? indexNote! : entry.path) && (
            <Pin size={12} className="pin-indicator" aria-label="Pinned" />
          )}
          {reserved && (
            <Lock size={11} className="tree-lock" aria-label="Managed by the calendar" />
          )}
        </button>
        {expandable && isOpen && children.length > 0 && (
          <ul role="group">{children.map((child) => renderNode(child))}</ul>
        )}
      </li>
    )
  }

  return (
    <>
      {pinnedEntries.length > 0 && (
        <>
          <div className="sidebar-section-label">Pinned</div>
          <ul className="file-tree" role="list">
            {pinnedEntries.map((entry) => (
              <li key={`pin-${entry.path}`}>
                <button
                  className="tree-item"
                  onClick={() => openEntry(entry)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setMenu({ x: e.clientX, y: e.clientY, entry })
                  }}
                  title={entry.path}
                >
                  <Pin size={12} className="pin-indicator" aria-hidden />
                  <span className="tree-label">{stem(entry.path)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="sidebar-section-label">Pages</div>
        </>
      )}
      <ul
        className={`file-tree file-tree-root${dropTarget === '' ? ' root-drop' : ''}`}
        role="tree"
        aria-label="Vault pages"
        onDragOver={(e) => {
          // Dropping on the empty area moves the item out to the vault root.
          if (e.target === e.currentTarget) {
            e.preventDefault()
            setDropTarget('')
          }
        }}
        onDragLeave={(e) => {
          if (e.target === e.currentTarget) setDropTarget(null)
        }}
        onDrop={(e) => {
          if (dropTarget === '') void onDropOnEntry({ path: '', kind: 'folder' }, e)
        }}
      >
        {tree.map((node) => renderNode(node))}
      </ul>
      {tree.length === 0 && (
        <p className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
          No pages yet. Create your first page with the button above — pages are ordinary Markdown
          files stored in this vault.
        </p>
      )}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.entry)}
          onClose={() => setMenu(null)}
        />
      )}
      {colorFor && (
        <div
          style={{ position: 'fixed', left: colorFor.x, top: colorFor.y, zIndex: 300 }}
          className="color-picker-anchor"
        >
          <ColorPicker
            current={getEntryColor(colorFor.path)}
            onClose={() => setColorFor(null)}
            onPick={(color: PageColor | null) => {
              void setEntryColor(colorFor.path, color).then(() =>
                ui.toast(color ? 'Colour set' : 'Colour removed', 'success'),
              )
            }}
          />
        </div>
      )}
      {movePaths && (
        <MovePicker
          paths={movePaths}
          entries={entries}
          onClose={() => setMovePaths(null)}
          onPick={(folder) => void doMove(movePaths, folder)}
        />
      )}
    </>
  )
}

/** Interactive destination picker for moving pages — a searchable folder list
 *  plus the vault root, instead of typing a path. */
function MovePicker({
  paths,
  entries,
  onClose,
  onPick,
}: {
  paths: string[]
  entries: Map<string, FileEntry>
  onClose: () => void
  onPick: (folder: string) => void
}) {
  const [query, setQuery] = useState('')
  const moving = new Set(paths)
  const folders = [...entries.values()]
    .filter(
      (e) =>
        e.kind === 'folder' &&
        !isReservedCalendarFolder(e.path) &&
        // Can't move an item into itself or its own subtree.
        ![...moving].some((p) => e.path === p || isWithin(p, e.path)),
    )
    .map((e) => e.path)
    .sort((a, b) => a.localeCompare(b))
  const q = query.toLowerCase().trim()
  const shown = folders.filter((f) => !q || f.toLowerCase().includes(q))
  const label = paths.length > 1 ? `Move ${paths.length} items to…` : `Move “${stem(paths[0])}” to…`

  return (
    <Modal title={label} onClose={onClose}>
      <input
        className="input"
        type="search"
        placeholder="Find a folder…"
        aria-label="Find a folder"
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 'var(--space-2)' }}
      />
      <div className="move-picker-list">
        {(!q || 'vault root'.includes(q)) && (
          <button className="attachment-row" onClick={() => onPick('')}>
            <Home size={15} aria-hidden />
            <span className="attachment-name">Vault root</span>
          </button>
        )}
        {shown.map((folder) => (
          <button key={folder} className="attachment-row" title={folder} onClick={() => onPick(folder)}>
            <FolderIcon size={15} aria-hidden />
            <span className="attachment-name">{basename(folder)}</span>
            <span className="attachment-path text-faint text-small">{folder}</span>
          </button>
        ))}
        {shown.length === 0 && (
          <p className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
            No matching folders. Create a folder first, or choose Vault root.
          </p>
        )}
      </div>
    </Modal>
  )
}

async function openAttachment(path: string): Promise<void> {
  const adapter = getAdapter()
  if (!adapter) return
  try {
    const blob = await adapter.readBinary(path)
    const url = URL.createObjectURL(blob)
    const opened = window.open(url, '_blank', 'noopener')
    if (!opened) downloadBlob(blob, basename(path))
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    useUi.getState().toast('Could not open attachment', 'error')
  }
}
