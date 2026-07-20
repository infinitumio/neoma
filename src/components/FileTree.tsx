// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The vault file tree: collapsible folders, context menus, pinning,
 * drag-and-drop organisation, and inline note/folder creation.
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
} from 'lucide-react'
import type { FileEntry } from '@/types'
import { ContextMenu, type MenuItem } from './ContextMenu'
import {
  useVault,
  deleteNote,
  deleteFolder,
  duplicateNote,
  moveNote,
  renameNote,
  renameFolder,
  togglePin,
  renameAttachment,
  getAdapter,
} from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { useUi } from '@/app/uiStore'
import { useSettings } from '@/settings/settingsStore'
import { basename, dirname, isMarkdown, stem } from '@/utils/paths'
import { downloadBlob } from '@/storage/import-export'

interface TreeNode {
  entry: FileEntry
  children: TreeNode[]
}

function buildTree(entries: Map<string, FileEntry>, sort: string): TreeNode[] {
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

  const openEntry = (entry: FileEntry) => {
    if (entry.kind === 'folder') toggleFolder(entry.path)
    else if (isMarkdown(entry.path)) openNote(entry.path)
    else void openAttachment(entry.path)
  }

  const askRename = (entry: FileEntry) => {
    ui.askPrompt({
      title: entry.kind === 'folder' ? 'Rename folder' : 'Rename note',
      label: 'New name',
      initial: entry.kind === 'folder' ? basename(entry.path) : stem(entry.path),
      onSubmit: async (value) => {
        try {
          if (entry.kind === 'folder') await renameFolder(entry.path, value)
          else if (isMarkdown(entry.path)) await renameNote(entry.path, value)
          else await renameAttachment(entry.path, value + '.' + entry.path.split('.').pop())
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
      title: 'Move note',
      label: `Target folder (empty for vault root). Existing: ${folders.slice(0, 8).join(', ') || 'none'}`,
      initial: dirname(entry.path),
      onSubmit: async (value) => {
        try {
          await moveNote(entry.path, value.trim())
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
      ui.toast('Moved to recently deleted', 'info')
    }
    if (!useSettings.getState().settings.confirmBeforeDelete) {
      void doDelete()
      return
    }
    ui.askConfirm({
      title: entry.kind === 'folder' ? 'Delete folder?' : 'Delete note?',
      message:
        entry.kind === 'folder'
          ? `Delete "${entry.path}" and everything inside it? Files go to Recently deleted first.`
          : `Delete "${entry.path}"? It can be restored from Recently deleted.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: doDelete,
    })
  }

  const menuItems = (entry: FileEntry): MenuItem[] => {
    if (entry.kind === 'folder') {
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
          onSelect: () => void openAttachment(entry.path),
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
    return [
      {
        label: 'Open in new tab',
        icon: <ExternalLink size={14} aria-hidden />,
        onSelect: () => openNote(entry.path, { newTab: true }),
      },
      {
        label: pinned.includes(entry.path) ? 'Unpin' : 'Pin',
        icon: <Pin size={14} aria-hidden />,
        separatorAfter: true,
        onSelect: () => togglePin(entry.path),
      },
      {
        label: 'Rename…',
        icon: <Pencil size={14} aria-hidden />,
        onSelect: () => askRename(entry),
      },
      {
        label: 'Move…',
        icon: <FolderInput size={14} aria-hidden />,
        onSelect: () => askMove(entry),
      },
      {
        label: 'Duplicate',
        icon: <Copy size={14} aria-hidden />,
        separatorAfter: true,
        onSelect: () => void duplicateNote(entry.path),
      },
      {
        label: 'Delete',
        icon: <Trash2 size={14} aria-hidden />,
        danger: true,
        onSelect: () => askDelete(entry),
      },
    ]
  }

  const onDropInto = async (targetFolder: string, event: React.DragEvent) => {
    event.preventDefault()
    setDropTarget(null)
    const sourcePath = event.dataTransfer.getData('application/x-neoma-path')
    if (!sourcePath || sourcePath === targetFolder) return
    if (dirname(sourcePath) === targetFolder) return
    try {
      await moveNote(sourcePath, targetFolder)
    } catch (err) {
      ui.toast(err instanceof Error ? err.message : 'Move failed', 'error')
    }
  }

  const renderNode = (node: TreeNode) => {
    const { entry } = node
    const isFolder = entry.kind === 'folder'
    const isOpen = !collapsed.has(entry.path)
    const isActive = activeTab?.type === 'note' && activeTab.path === entry.path
    return (
      <li key={entry.path} role="treeitem" aria-expanded={isFolder ? isOpen : undefined}>
        <button
          className={`tree-item${isActive ? ' active' : ''}${dropTarget === entry.path ? ' drop-target' : ''}`}
          onClick={() => openEntry(entry)}
          onContextMenu={(e) => {
            e.preventDefault()
            setMenu({ x: e.clientX, y: e.clientY, entry })
          }}
          draggable={!isFolder}
          onDragStart={(e) => {
            e.dataTransfer.setData('application/x-neoma-path', entry.path)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={
            isFolder
              ? (e) => {
                  e.preventDefault()
                  setDropTarget(entry.path)
                }
              : undefined
          }
          onDragLeave={isFolder ? () => setDropTarget(null) : undefined}
          onDrop={isFolder ? (e) => void onDropInto(entry.path, e) : undefined}
          title={entry.path}
        >
          {isFolder ? (
            <>
              <ChevronRight
                size={14}
                className={`tree-chevron${isOpen ? ' open' : ''}`}
                aria-hidden
              />
              <FolderIcon size={14} aria-hidden />
            </>
          ) : isMarkdown(entry.path) ? (
            <FileText size={14} aria-hidden style={{ marginLeft: 14, flexShrink: 0 }} />
          ) : (
            <Paperclip size={14} aria-hidden style={{ marginLeft: 14, flexShrink: 0 }} />
          )}
          <span className="tree-label">{isFolder ? basename(entry.path) : stem(entry.path)}</span>
          {pinned.includes(entry.path) && (
            <Pin size={12} className="pin-indicator" aria-label="Pinned" />
          )}
        </button>
        {isFolder && isOpen && node.children.length > 0 && (
          <ul role="group">{node.children.map((child) => renderNode(child))}</ul>
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
                <button className="tree-item" onClick={() => openEntry(entry)} title={entry.path}>
                  <Pin size={12} className="pin-indicator" aria-hidden />
                  <span className="tree-label">{stem(entry.path)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="sidebar-section-label">Files</div>
        </>
      )}
      <ul
        className="file-tree"
        role="tree"
        aria-label="Vault files"
        onDragOver={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault()
            setDropTarget('')
          }
        }}
        onDrop={(e) => {
          if (dropTarget === '') void onDropInto('', e)
        }}
      >
        {tree.map((node) => renderNode(node))}
      </ul>
      {tree.length === 0 && (
        <p className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
          No notes yet. Create one with the button above.
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
