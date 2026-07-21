// SPDX-License-Identifier: AGPL-3.0-or-later
/** First-party commands registered when a vault is open. */
import type { Command } from '@/types'
import { useUi } from '@/app/uiStore'
import { useTabs } from '@/app/tabsStore'
import {
  useVault,
  createNote,
  createSubpage,
  saveNoteNow,
  renamePage,
  closeVault,
  getAdapter,
} from '@/app/vaultStore'
import { useSettings } from '@/settings/settingsStore'
import { openDaily } from '@/components/panels/DailyPanel'
import { exportVaultZip, exportNoteMarkdown, downloadBlob } from '@/storage/import-export'
import { stem, dirname } from '@/utils/paths'

const activeNotePath = (): string | null => {
  const tabs = useTabs.getState()
  const active = tabs.tabs.find((t) => t.id === tabs.activeId)
  return active?.type === 'note' ? (active.path ?? null) : null
}

const hasVault = () => useVault.getState().status === 'ready'
const hasActiveNote = () => hasVault() && activeNotePath() !== null

export function buildDefaultCommands(): Command[] {
  return [
    {
      id: 'app.command-palette',
      title: 'Show command palette',
      category: 'Application',
      shortcut: 'Mod+K',
      run: () => useUi.getState().openPalette('commands'),
    },
    {
      id: 'note.new',
      title: 'Create page',
      category: 'Pages',
      shortcut: 'Mod+Alt+N',
      isAvailable: hasVault,
      run: async () => {
        const path = await createNote('', 'Untitled')
        if (path) {
          useTabs.getState().openNote(path)
          useUi.getState().toast('Page created', 'success')
        }
      },
    },
    {
      id: 'attachment.insert',
      title: 'Insert attachment (choose or add a file)…',
      category: 'Pages',
      isAvailable: hasActiveNote,
      run: () => {
        const path = activeNotePath()
        if (path) useUi.getState().setAttachmentPickerFor(path)
      },
    },
    {
      id: 'page.new-subpage',
      title: 'Create subpage of current page',
      category: 'Pages',
      isAvailable: hasActiveNote,
      run: () => {
        const parent = activeNotePath()
        if (!parent) return
        useUi.getState().askPrompt({
          title: 'New subpage',
          label: 'Subpage title',
          confirmLabel: 'Create',
          onSubmit: async (value) => {
            const created = await createSubpage(parent, value.trim() || 'Untitled')
            if (created) {
              useTabs.getState().openNote(created)
              useUi.getState().toast('Subpage created', 'success')
            }
          },
        })
      },
    },
    {
      id: 'note.quick-open',
      title: 'Open page…',
      category: 'Pages',
      shortcut: 'Mod+O',
      isAvailable: hasVault,
      run: () => useUi.getState().openPalette('notes'),
    },
    {
      id: 'app.search',
      title: 'Search vault',
      category: 'Search',
      shortcut: 'Mod+Shift+F',
      isAvailable: hasVault,
      run: () => {
        useUi.getState().setSidePanel('search')
        useUi.getState().setSidebarOpen(true)
      },
    },
    {
      id: 'note.save',
      title: 'Save page now',
      category: 'Pages',
      shortcut: 'Mod+S',
      isAvailable: hasActiveNote,
      run: async () => {
        const path = activeNotePath()
        if (path) await saveNoteNow(path)
      },
    },
    {
      id: 'daily.open-today',
      title: "Open today's journal",
      category: 'Daily notes',
      shortcut: 'Mod+D',
      isAvailable: hasVault,
      run: () => openDaily(new Date()),
    },
    {
      id: 'template.insert',
      title: 'New note from template…',
      category: 'Templates',
      isAvailable: hasVault,
      run: () => {
        useUi.getState().setSidePanel('templates')
        useUi.getState().setSidebarOpen(true)
      },
    },
    {
      id: 'ui.toggle-sidebar',
      title: 'Toggle sidebar',
      category: 'View',
      shortcut: 'Mod+\\',
      run: () => useUi.getState().toggleSidebar(),
    },
    {
      id: 'ui.toggle-right-sidebar',
      title: 'Toggle context sidebar',
      category: 'View',
      shortcut: 'Mod+Shift+\\',
      run: () => useUi.getState().toggleRightSidebar(),
    },
    {
      id: 'ui.toggle-reading',
      title: 'Toggle reading view',
      category: 'View',
      shortcut: 'Mod+Shift+R',
      isAvailable: hasActiveNote,
      run: () => {
        const ui = useUi.getState()
        ui.setEditorMode(ui.editorMode === 'reading' ? 'edit' : 'reading')
      },
    },
    {
      id: 'ui.toggle-split',
      title: 'Toggle split edit and preview',
      category: 'View',
      shortcut: 'Mod+Shift+E',
      isAvailable: hasActiveNote,
      run: () => {
        const ui = useUi.getState()
        ui.setEditorMode(ui.editorMode === 'split' ? 'edit' : 'split')
      },
    },
    {
      id: 'ui.toggle-source',
      title: 'View Markdown source',
      category: 'View',
      shortcut: 'Mod+Shift+M',
      isAvailable: hasActiveNote,
      run: () => {
        const ui = useUi.getState()
        ui.setEditorMode(ui.editorMode === 'source' ? 'edit' : 'source')
      },
    },
    {
      id: 'ui.toggle-theme',
      title: 'Toggle dark/light theme',
      category: 'View',
      run: () => {
        const settings = useSettings.getState()
        settings.update('theme', settings.settings.theme === 'dark' ? 'light' : 'dark')
      },
    },
    {
      id: 'note.rename',
      title: 'Rename page…',
      category: 'Pages',
      isAvailable: hasActiveNote,
      run: () => {
        const path = activeNotePath()
        if (!path) return
        useUi.getState().askPrompt({
          title: 'Rename page',
          label: 'New name',
          initial: stem(path),
          onSubmit: async (value) => {
            try {
              await renamePage(path, value)
              useUi.getState().toast('Page renamed', 'success')
            } catch (err) {
              useUi.getState().toast(err instanceof Error ? err.message : 'Rename failed', 'error')
            }
          },
        })
      },
    },
    {
      id: 'note.move',
      title: 'Move page…',
      category: 'Pages',
      isAvailable: hasActiveNote,
      run: () => {
        const path = activeNotePath()
        if (!path) return
        useUi.getState().askPrompt({
          title: 'Move page',
          label: 'Target folder (empty for vault root)',
          initial: dirname(path),
          onSubmit: async (value) => {
            const { moveNote } = await import('@/app/vaultStore')
            await moveNote(path, value.trim())
          },
        })
      },
    },
    {
      id: 'note.export-markdown',
      title: 'Export note as Markdown',
      category: 'Export',
      isAvailable: hasActiveNote,
      run: () => {
        const path = activeNotePath()
        const note = path ? useVault.getState().notes.get(path) : null
        if (path && note) exportNoteMarkdown(path, note.content)
      },
    },
    {
      id: 'note.export-html',
      title: 'Export note as HTML',
      category: 'Export',
      isAvailable: hasActiveNote,
      run: async () => {
        const path = activeNotePath()
        const note = path ? useVault.getState().notes.get(path) : null
        if (!path || !note) return
        const [{ renderMarkdown }, { exportNoteHtml }] = await Promise.all([
          import('@/markdown/render'),
          import('@/storage/import-export'),
        ])
        const { getLinkGraph } = await import('@/app/vaultStore')
        const html = await renderMarkdown(note.content, {
          resolveLink: (t) => getLinkGraph().resolve(t, path),
        })
        exportNoteHtml(path, html)
      },
    },
    {
      id: 'note.export-pdf',
      title: 'Export note as PDF (print)',
      category: 'Export',
      isAvailable: hasActiveNote,
      run: () => {
        // Switch to reading view (the print stylesheet targets it), then print.
        useUi.getState().setEditorMode('reading')
        setTimeout(() => window.print(), 350)
      },
    },
    {
      id: 'vault.export-zip',
      title: 'Export vault as ZIP',
      category: 'Export',
      isAvailable: hasVault,
      run: async () => {
        const adapter = getAdapter()
        const vault = useVault.getState().vault
        if (!adapter || !vault) return
        const blob = await exportVaultZip(adapter)
        downloadBlob(blob, `${vault.name}.zip`)
      },
    },
    {
      id: 'graph.open',
      title: 'Open graph view',
      category: 'View',
      shortcut: 'Mod+G',
      isAvailable: hasVault,
      run: () => useTabs.getState().openSpecial('graph'),
    },
    {
      id: 'tab.close',
      title: 'Close active tab',
      category: 'Tabs',
      shortcut: 'Mod+Alt+W',
      run: () => useTabs.getState().closeActive(),
    },
    {
      id: 'tab.reopen',
      title: 'Reopen closed tab',
      category: 'Tabs',
      shortcut: 'Mod+Alt+T',
      run: () => useTabs.getState().reopenClosed(),
    },
    {
      id: 'app.settings',
      title: 'Open settings',
      category: 'Application',
      shortcut: 'Mod+,',
      run: () => useUi.getState().setSettingsOpen(true),
    },
    {
      id: 'app.shortcuts',
      title: 'Show keyboard shortcuts',
      category: 'Application',
      shortcut: 'Mod+/',
      run: () => useUi.getState().setShortcutsHelpOpen(true),
    },
    {
      id: 'app.help',
      title: 'Open Help',
      category: 'Application',
      shortcut: 'F1',
      run: () => useUi.getState().setHelpOpen(true),
    },
    {
      id: 'vault.switch',
      title: 'Switch vault…',
      category: 'Application',
      shortcut: 'Mod+Shift+O',
      isAvailable: hasVault,
      run: () => useUi.getState().setVaultSwitcherOpen(true),
    },
    {
      id: 'vault.close',
      title: 'Close vault (back to welcome)',
      category: 'Application',
      isAvailable: hasVault,
      run: () => closeVault(),
    },
  ]
}
