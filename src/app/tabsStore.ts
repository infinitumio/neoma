// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Lightweight editor tabs. Only the active tab's editor is rendered; the
 * others keep their state in the vault store's note cache. Open tabs are
 * persisted per-vault so reopening the app restores the workspace.
 */
import { create } from 'zustand'
import type { TabState } from '@/types'
import { generateId } from '@/utils/misc'
import { recordRecentPdf } from '@/utils/recentPdfs'
import { useVault } from './vaultStore'

interface TabsStore {
  vaultId: string | null
  tabs: TabState[]
  activeId: string | null
  recentlyClosed: TabState[]

  openNote: (path: string, options?: { newTab?: boolean }) => void
  openSpecial: (type: 'graph' | 'settings' | 'calendar') => void
  openPdf: (path: string, options?: { page?: number; splitNote?: string }) => void
  setPdfSplitNote: (id: string, note: string | undefined) => void
  close: (id: string) => void
  closeOthers: (id: string) => void
  closeActive: () => void
  setActive: (id: string) => void
  togglePin: (id: string) => void
  reopenClosed: () => void
  handleRename: (oldPath: string, newPath: string) => void
  handleDelete: (path: string) => void
  restoreForVault: (vaultId: string) => void
  clear: () => void
}

function storageKey(vaultId: string): string {
  return `neoma.tabs.${vaultId}`
}

function persist(state: Pick<TabsStore, 'vaultId' | 'tabs' | 'activeId'>): void {
  if (!state.vaultId) return
  localStorage.setItem(
    storageKey(state.vaultId),
    JSON.stringify({ tabs: state.tabs, activeId: state.activeId }),
  )
}

export const useTabs = create<TabsStore>((set, get) => {
  const apply = (partial: Partial<TabsStore>) => {
    set(partial)
    const { vaultId, tabs, activeId } = get()
    persist({ vaultId, tabs, activeId })
  }

  return {
    vaultId: null,
    tabs: [],
    activeId: null,
    recentlyClosed: [],

    openNote: (path, options = {}) => {
      const { tabs, activeId } = get()
      const existing = tabs.find((t) => t.type === 'note' && t.path === path)
      if (existing) {
        apply({ activeId: existing.id })
        return
      }
      const active = tabs.find((t) => t.id === activeId)
      if (!options.newTab && active && active.type === 'note' && !active.pinned) {
        // Replace the current tab's note (single-click open behaviour).
        apply({
          tabs: tabs.map((t) => (t.id === active.id ? { ...t, path } : t)),
          activeId: active.id,
        })
        return
      }
      const tab: TabState = { id: generateId(), type: 'note', path, pinned: false }
      apply({ tabs: [...tabs, tab], activeId: tab.id })
    },

    openSpecial: (type) => {
      const { tabs } = get()
      const existing = tabs.find((t) => t.type === type)
      if (existing) {
        apply({ activeId: existing.id })
        return
      }
      const tab: TabState = { id: generateId(), type, pinned: false }
      apply({ tabs: [...tabs, tab], activeId: tab.id })
    },

    openPdf: (path, options = {}) => {
      recordRecentPdf(useVault.getState().vault?.id, path)
      const { tabs } = get()
      const existing = tabs.find((t) => t.type === 'pdf' && t.path === path)
      if (existing) {
        apply({
          activeId: existing.id,
          tabs: tabs.map((t) =>
            t.id === existing.id ? { ...t, pdfPage: options.page ?? t.pdfPage } : t,
          ),
        })
        // Nudge an already-open viewer to the requested page.
        if (options.page) {
          window.dispatchEvent(
            new CustomEvent('neoma:pdf-goto', { detail: { path, page: options.page } }),
          )
        }
        return
      }
      const tab: TabState = {
        id: generateId(),
        type: 'pdf',
        path,
        pinned: false,
        pdfPage: options.page,
        pdfSplitNote: options.splitNote,
      }
      apply({ tabs: [...tabs, tab], activeId: tab.id })
    },

    setPdfSplitNote: (id, note) =>
      apply({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, pdfSplitNote: note } : t)) }),

    close: (id) => {
      const { tabs, activeId, recentlyClosed } = get()
      const index = tabs.findIndex((t) => t.id === id)
      if (index === -1) return
      const closing = tabs[index]
      const next = tabs.filter((t) => t.id !== id)
      let nextActive = activeId
      if (activeId === id) {
        nextActive = next[Math.min(index, next.length - 1)]?.id ?? null
      }
      apply({
        tabs: next,
        activeId: nextActive,
        recentlyClosed:
          closing.type === 'note' ? [...recentlyClosed.slice(-9), closing] : recentlyClosed,
      })
    },

    closeOthers: (id) => {
      const { tabs } = get()
      const keep = tabs.filter((t) => t.id === id || t.pinned)
      const closed = tabs.filter((t) => !keep.includes(t) && t.type === 'note')
      apply({
        tabs: keep,
        activeId: id,
        recentlyClosed: [...get().recentlyClosed, ...closed].slice(-10),
      })
    },

    closeActive: () => {
      const { activeId } = get()
      if (activeId) get().close(activeId)
    },

    setActive: (id) => apply({ activeId: id }),

    togglePin: (id) =>
      apply({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)) }),

    reopenClosed: () => {
      const { recentlyClosed, tabs } = get()
      const last = recentlyClosed[recentlyClosed.length - 1]
      if (!last) return
      apply({
        recentlyClosed: recentlyClosed.slice(0, -1),
        tabs: [...tabs, last],
        activeId: last.id,
      })
    },

    handleRename: (oldPath, newPath) =>
      apply({
        tabs: get().tabs.map((t) =>
          t.type === 'note' && t.path === oldPath ? { ...t, path: newPath } : t,
        ),
      }),

    handleDelete: (path) => {
      const tab = get().tabs.find((t) => t.type === 'note' && t.path === path)
      if (tab) get().close(tab.id)
    },

    restoreForVault: (vaultId) => {
      let tabs: TabState[] = []
      let activeId: string | null = null
      try {
        const raw = localStorage.getItem(storageKey(vaultId))
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed.tabs)) {
            tabs = parsed.tabs.filter(
              (t: TabState) => t && typeof t.id === 'string' && (t.type !== 'note' || t.path),
            )
            activeId = tabs.some((t) => t.id === parsed.activeId)
              ? parsed.activeId
              : (tabs[0]?.id ?? null)
          }
        }
      } catch {
        // Corrupt persisted tabs: start clean.
      }
      set({ vaultId, tabs, activeId, recentlyClosed: [] })
    },

    clear: () => set({ vaultId: null, tabs: [], activeId: null, recentlyClosed: [] }),
  }
})
