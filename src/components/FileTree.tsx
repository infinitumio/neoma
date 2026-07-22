// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The page tree: collapsible pages and subpages (folder-note convention),
 * context menus, pinning, and drag-and-drop organisation — drop a page onto
 * a folder to move it, or onto another page to nest it as a subpage.
 */
import { useMemo, useState } from 'react'
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
import { basename, dirname, folderNoteOf, isMarkdown, isPdf, stem } from '@/utils/paths'
import { downloadBlob, importFiles } from '@/storage/import-export'

export interface TreeNode {
  entry: FileEntry
  children: TreeNode[]
}

export function buildTree(entries: Map<string, FileEntry>, sort: string): TreeNode[] {
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
  return (byFolder.get('') ?? []).sort(compare)
}

interface MenuState {
  x: number
  y: number
  entry: FileEntry
}

export function FileTree() {
  const entries = useVault((s) => s.entries)
  const pinned = useVault((s) => s.pinned)
  const sortOrder = useSettings((s) => s.settings.fileSortOrder)
  const activeTab = useTabs((s) => s.tabs.find((t) => t.id === s.activeId))
  const openNote = useTabs((s) => s.openNote)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [colorFor, setColorFor] = useState<{ x: number; y: number; path: string } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const ui = useUi()

  const tree = useMemo(() => buildTree(entries, sortOrder), [entries, sortOrder])
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

  const openEntry = (entry: FileEntry) => {
    if (entry.kind === 'folder') {
      const indexNote = indexNoteOf(entry.path)
      if (indexNote) openNote(indexNote)
      else toggleFolder(entry.path)
    } else if (isMarkdown(entry.path)) openNote(entry.path)
    else if (isPdf(entry.path)) useTabs.getState().openPdf(entry.path)
    else void openAttachment(entry.path)
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

  const askMove = (entry: FileEntry) => {
    const folders = [...entries.values()]
      .filter((e) => e.kind === 'folder')
      .map((e) => e.path)
      .sort()
    ui.askPrompt({
      title: 'Move page',
      label: `Target folder (empty for vault root). Existing: ${folders.slice(0, 8).join(', ') || 'none'}`,
      initial: dirname(entry.path),
      onSubmit: async (value) => {
        try {
          await moveNote(entry.path, value.trim())
          ui.toast('Page moved', 'success')
        } catch (err) {
          ui.toast(err instanceof Error ? err.message : 'Move failed', 'error')
        }
      },
    })
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
    if (entry.kind === 'folder') {
      const indexNote = indexNoteOf(entry.path)
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
    try {
      if (target.kind === 'folder') {
        if (dirname(sourcePath) === target.path) return
        await moveNote(sourcePath, target.path)
        ui.toast('Page moved', 'success')
      } else if (isMarkdown(target.path)) {
        await nestUnder(sourcePath, target.path)
        ui.toast(`Nested under "${stem(target.path)}"`, 'success')
      }
    } catch (err) {
      ui.toast(err instanceof Error ? err.message : 'Move failed', 'error')
    }
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
    return (
      <li key={entry.path} role="treeitem" aria-expanded={expandable ? isOpen : undefined}>
        <button
          className={`tree-item${isActive ? ' active' : ''}${dropTarget === entry.path ? ' drop-target' : ''}`}
          onClick={() => openEntry(entry)}
          onContextMenu={(e) => {
            e.preventDefault()
            setMenu({ x: e.clientX, y: e.clientY, entry })
          }}
          draggable={!isFolder || isPageFolder}
          onDragStart={(e) => {
            e.dataTransfer.setData(
              'application/x-neoma-path',
              isPageFolder ? indexNote! : entry.path,
            )
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={
            droppable
              ? (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDropTarget(entry.path)
                }
              : undefined
          }
          onDragLeave={droppable ? () => setDropTarget(null) : undefined}
          onDrop={droppable ? (e) => void onDropOnEntry(entry, e) : undefined}
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
        className="file-tree"
        role="tree"
        aria-label="Vault pages"
        onDragOver={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault()
            setDropTarget('')
          }
        }}
        onDrop={(e) => {
          if (dropTarget === '') {
            void onDropOnEntry({ path: '', kind: 'folder' }, e)
          }
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
    </>
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
