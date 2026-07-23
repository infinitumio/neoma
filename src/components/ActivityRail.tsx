// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Left activity rail. Panels are provided by the panel registry so future
 * plugins can add entries without touching this component.
 */
import { useState } from 'react'
import {
  Waypoints,
  Settings,
  Github,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
} from 'lucide-react'
import { useUi } from '@/app/uiStore'
import { useTabs } from '@/app/tabsStore'
import { REPOSITORY_URL } from '@/app/about'
import { listPanels } from '@/app/registries'
import { registerBuiltinPanels } from '@/app/registerBuiltins'

registerBuiltinPanels()

const GROUP_LABELS: Record<string, string> = { planner: 'Planner' }

export function ActivityRail() {
  const ui = useUi()
  const openSpecial = useTabs((s) => s.openSpecial)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const toggleGroup = (g: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })

  if (ui.railCollapsed) {
    return (
      <nav className="activity-rail" aria-label="Primary" style={{ width: 'auto' }}>
        <button className="rail-btn" onClick={ui.toggleRail} aria-label="Expand activity rail">
          <PanelLeftOpen size={18} aria-hidden />
        </button>
      </nav>
    )
  }

  return (
    <nav className="activity-rail" aria-label="Primary">
      <img src="/favicon.svg" alt="" className="rail-logo" aria-hidden />
      {(() => {
        const rendered: React.ReactNode[] = []
        const seenGroups = new Set<string>()
        let groupIndex = 0
        for (const { id, label, icon: Icon, group } of listPanels()) {
          if (group) {
            // Render the collapsible group toggle once, then its members when open.
            if (!seenGroups.has(group)) {
              seenGroups.add(group)
              const isOpen = openGroups.has(group)
              rendered.push(
                <button
                  key={`group-${group}`}
                  className={`rail-btn rail-group-toggle${isOpen ? ' active' : ''}`}
                  aria-label={GROUP_LABELS[group] ?? group}
                  title={GROUP_LABELS[group] ?? group}
                  aria-expanded={isOpen}
                  onClick={() => toggleGroup(group)}
                >
                  <LayoutDashboard size={18} aria-hidden />
                </button>,
              )
            }
            if (!openGroups.has(group)) continue
          }
          rendered.push(
            <button
              key={id}
              className={`rail-btn${group ? ' rail-group-item' : ''}`}
              aria-label={label}
              title={label}
              aria-pressed={ui.sidePanel === id && ui.sidebarOpen}
              style={group ? { animationDelay: `${groupIndex++ * 0.04}s` } : undefined}
              onClick={() => ui.setSidePanel(id)}
            >
              <Icon size={18} aria-hidden />
            </button>,
          )
        }
        return rendered
      })()}
      <button
        className="rail-btn"
        aria-label="Graph view"
        title="Graph view"
        onClick={() => openSpecial('graph')}
      >
        <Waypoints size={18} aria-hidden />
      </button>
      <div className="rail-spacer" />
      <button
        className="rail-btn"
        aria-label="Help"
        title="Help"
        onClick={() => ui.setHelpOpen(true)}
      >
        <HelpCircle size={18} aria-hidden />
      </button>
      <button
        className="rail-btn"
        aria-label="Settings"
        title="Settings"
        onClick={() => ui.setSettingsOpen(true)}
      >
        <Settings size={18} aria-hidden />
      </button>
      <a
        className="rail-btn"
        href={REPOSITORY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Neoma on GitHub (opens in new tab)"
        title="GitHub repository"
      >
        <Github size={18} aria-hidden />
      </a>
      <button className="rail-btn" onClick={ui.toggleRail} aria-label="Collapse activity rail">
        <PanelLeftClose size={18} aria-hidden />
      </button>
    </nav>
  )
}
