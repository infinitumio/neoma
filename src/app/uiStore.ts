// SPDX-License-Identifier: AGPL-3.0-or-later
/** Transient UI state: panels, dialogs, palette, toasts. Not persisted. */
import { create } from 'zustand'
import type { EditorMode } from '@/types'
import { generateId } from '@/utils/misc'

export type SidePanelId =
  | 'files'
  | 'search'
  | 'tags'
  | 'backlinks'
  | 'daily'
  | 'study'
  | 'templates'
  | 'trash'

export type RightPanelId = 'outline' | 'backlinks' | 'properties' | 'info'

export interface Toast {
  id: string
  kind: 'info' | 'success' | 'warning' | 'error'
  message: string
  /** optional action button, e.g. Undo */
  action?: { label: string; run: () => void | Promise<void> }
}

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}

export interface PromptRequest {
  title: string
  label: string
  initial?: string
  placeholder?: string
  confirmLabel?: string
  onSubmit: (value: string) => void | Promise<void>
}

interface UiState {
  sidePanel: SidePanelId
  sidebarOpen: boolean
  railCollapsed: boolean
  rightSidebarOpen: boolean
  rightPanel: RightPanelId
  editorMode: EditorMode
  paletteOpen: boolean
  paletteMode: 'commands' | 'notes'
  shortcutsHelpOpen: boolean
  helpOpen: boolean
  vaultSwitcherOpen: boolean
  attachmentPickerFor: string | null
  settingsOpen: boolean
  confirm: ConfirmRequest | null
  prompt: PromptRequest | null
  toasts: Toast[]

  setSidePanel: (panel: SidePanelId) => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleRail: () => void
  toggleRightSidebar: () => void
  setRightPanel: (panel: RightPanelId) => void
  setEditorMode: (mode: EditorMode) => void
  openPalette: (mode?: 'commands' | 'notes') => void
  closePalette: () => void
  setShortcutsHelpOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setVaultSwitcherOpen: (open: boolean) => void
  setAttachmentPickerFor: (notePath: string | null) => void
  setSettingsOpen: (open: boolean) => void
  askConfirm: (request: ConfirmRequest) => void
  askPrompt: (request: PromptRequest) => void
  clearDialogs: () => void
  toast: (message: string, kind?: Toast['kind'], action?: Toast['action']) => void
  dismissToast: (id: string) => void
}

export const useUi = create<UiState>((set) => ({
  sidePanel: 'files',
  sidebarOpen: true,
  railCollapsed: false,
  rightSidebarOpen: false,
  rightPanel: 'outline',
  editorMode: 'edit',
  paletteOpen: false,
  paletteMode: 'commands',
  shortcutsHelpOpen: false,
  helpOpen: false,
  vaultSwitcherOpen: false,
  attachmentPickerFor: null,
  settingsOpen: false,
  confirm: null,
  prompt: null,
  toasts: [],

  setSidePanel: (panel) =>
    set((s) => ({
      sidePanel: panel,
      // Clicking the active panel's rail icon toggles the sidebar.
      sidebarOpen: s.sidePanel === panel ? !s.sidebarOpen : true,
    })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleRail: () => set((s) => ({ railCollapsed: !s.railCollapsed })),
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
  setRightPanel: (panel) => set({ rightPanel: panel, rightSidebarOpen: true }),
  setEditorMode: (mode) => set({ editorMode: mode }),
  openPalette: (mode = 'commands') => set({ paletteOpen: true, paletteMode: mode }),
  closePalette: () => set({ paletteOpen: false }),
  setShortcutsHelpOpen: (open) => set({ shortcutsHelpOpen: open }),
  setHelpOpen: (open) => set({ helpOpen: open }),
  setVaultSwitcherOpen: (open) => set({ vaultSwitcherOpen: open }),
  setAttachmentPickerFor: (notePath) => set({ attachmentPickerFor: notePath }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  askConfirm: (request) => set({ confirm: request }),
  askPrompt: (request) => set({ prompt: request }),
  clearDialogs: () => set({ confirm: null, prompt: null }),
  toast: (message, kind = 'info', action) =>
    set((s) => {
      const toast: Toast = { id: generateId(), kind, message, action }
      setTimeout(() => useUi.getState().dismissToast(toast.id), action ? 8000 : 5000)
      return { toasts: [...s.toasts.slice(-3), toast] }
    }),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
