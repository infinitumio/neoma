// SPDX-License-Identifier: AGPL-3.0-or-later
/** Editor tabs: switch, close, pin, middle-click close, context menu. */
import { useState } from 'react'
import { X, Pin, Waypoints, Settings, FileText } from 'lucide-react'
import { useTabs } from '@/app/tabsStore'
import { useVault } from '@/app/vaultStore'
import { ContextMenu } from './ContextMenu'
import { stem } from '@/utils/paths'
import type { TabState } from '@/types'

export function TabsBar() {
  const tabs = useTabs((s) => s.tabs)
  const activeId = useTabs((s) => s.activeId)
  const { setActive, close, closeOthers, togglePin, reopenClosed } = useTabs.getState()
  const notes = useVault((s) => s.notes)
  const [menu, setMenu] = useState<{ x: number; y: number; tab: TabState } | null>(null)

  if (tabs.length === 0) return null

  const label = (tab: TabState): string => {
    if (tab.type === 'graph') return 'Graph'
    if (tab.type === 'settings') return 'Settings'
    return tab.path ? stem(tab.path) : 'Untitled'
  }

  return (
    <div className="tabs-bar" role="tablist" aria-label="Open notes">
      {tabs.map((tab) => {
        const isDirty =
          tab.type === 'note' && tab.path
            ? notes.get(tab.path)?.saveState === 'unsaved' ||
              notes.get(tab.path)?.saveState === 'saving'
            : false
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeId}
            tabIndex={0}
            className={`tab${tab.id === activeId ? ' active' : ''}`}
            onClick={() => setActive(tab.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setActive(tab.id)
            }}
            onAuxClick={(e) => {
              if (e.button === 1) close(tab.id)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              setMenu({ x: e.clientX, y: e.clientY, tab })
            }}
            title={tab.path ?? label(tab)}
          >
            {tab.type === 'graph' ? (
              <Waypoints size={13} aria-hidden />
            ) : tab.type === 'settings' ? (
              <Settings size={13} aria-hidden />
            ) : (
              <FileText size={13} aria-hidden />
            )}
            <span className="tab-label">{label(tab)}</span>
            {tab.pinned && <Pin size={11} className="pin-indicator" aria-label="Pinned tab" />}
            {isDirty && <span className="dirty-dot" aria-label="Unsaved changes" />}
            <button
              className="icon-btn tab-close"
              aria-label={`Close ${label(tab)}`}
              onClick={(e) => {
                e.stopPropagation()
                close(tab.id)
              }}
            >
              <X size={13} aria-hidden />
            </button>
          </div>
        )
      })}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Close tab', onSelect: () => close(menu.tab.id) },
            { label: 'Close other tabs', onSelect: () => closeOthers(menu.tab.id) },
            {
              label: menu.tab.pinned ? 'Unpin tab' : 'Pin tab',
              separatorAfter: true,
              onSelect: () => togglePin(menu.tab.id),
            },
            { label: 'Reopen closed tab', onSelect: () => reopenClosed() },
          ]}
        />
      )}
    </div>
  )
}
