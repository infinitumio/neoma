// SPDX-License-Identifier: AGPL-3.0-or-later
/** File explorer panel: vault header, new note/folder, sort, import/export. */
import { useRef, useState } from 'react'
import { FilePlus, FolderPlus, ArrowUpDown, MoreHorizontal, Download, Upload } from 'lucide-react'
import { FileTree } from '../FileTree'
import { ContextMenu } from '../ContextMenu'
import { createNote, createFolder, refreshEntries, useVault, getAdapter } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { useUi } from '@/app/uiStore'
import { useSettings } from '@/settings/settingsStore'
import type { SortOrder } from '@/types'
import { exportVaultZip, importFiles, downloadBlob } from '@/storage/import-export'

export function FilesPanel() {
  const vault = useVault((s) => s.vault)
  const ui = useUi()
  const update = useSettings((s) => s.update)
  const sortOrder = useSettings((s) => s.settings.fileSortOrder)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const newNote = async () => {
    const path = await createNote('', 'Untitled')
    if (path) {
      useTabs.getState().openNote(path)
      useUi.getState().toast('Page created', 'success')
    }
  }

  const newFolder = () => {
    ui.askPrompt({
      title: 'New folder',
      label: 'Folder name',
      placeholder: 'e.g. Projects',
      onSubmit: async (value) => {
        if (value.trim()) await createFolder('', value)
      },
    })
  }

  const cycleSort = () => {
    const orders: SortOrder[] = ['name', 'created', 'modified']
    const next = orders[(orders.indexOf(sortOrder) + 1) % orders.length]
    update('fileSortOrder', next)
    ui.toast(`Sorted by ${next === 'name' ? 'name' : next + ' date'}`)
  }

  const exportZip = async () => {
    const adapter = getAdapter()
    if (!adapter || !vault) return
    ui.toast('Preparing vault export…')
    try {
      const blob = await exportVaultZip(adapter)
      downloadBlob(blob, `${vault.name}.zip`)
      ui.toast('Vault exported', 'success')
    } catch {
      ui.toast('Export failed', 'error')
    }
  }

  const onImportFiles = async (files: FileList | null) => {
    const adapter = getAdapter()
    if (!adapter || !files?.length) return
    const summary = await importFiles(adapter, [...files])
    await refreshEntries()
    ui.toast(`Imported ${summary.notes} notes, ${summary.attachments} attachments`, 'success')
  }

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title" title={vault?.name}>
          {vault?.name ?? 'Vault'}
        </span>
        <button
          className="icon-btn"
          onClick={() => void newNote()}
          aria-label="New page"
          title="New page"
        >
          <FilePlus size={16} aria-hidden />
        </button>
        <button className="icon-btn" onClick={newFolder} aria-label="New folder" title="New folder">
          <FolderPlus size={16} aria-hidden />
        </button>
        <button
          className="icon-btn"
          onClick={cycleSort}
          aria-label={`Sort order: ${sortOrder}. Click to change`}
          title={`Sort: ${sortOrder}`}
        >
          <ArrowUpDown size={16} aria-hidden />
        </button>
        <button
          className="icon-btn"
          onClick={(e) => setMenu({ x: e.clientX, y: e.clientY })}
          aria-label="More vault actions"
          aria-haspopup="menu"
        >
          <MoreHorizontal size={16} aria-hidden />
        </button>
      </div>
      <div className="sidebar-body">
        <FileTree />
      </div>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".md,.zip,image/*,application/pdf"
        className="visually-hidden"
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          void onImportFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            {
              label: 'Import files or ZIP…',
              icon: <Upload size={14} aria-hidden />,
              onSelect: () => fileInput.current?.click(),
            },
            {
              label: 'Export vault as ZIP',
              icon: <Download size={14} aria-hidden />,
              onSelect: () => void exportZip(),
            },
          ]}
        />
      )}
    </>
  )
}
