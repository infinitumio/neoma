// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Left activity rail. Panels are provided by the panel registry so future
 * plugins can add entries without touching this component.
 */
import {
  Waypoints,
  CalendarRange,
  Settings,
  Github,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useUi } from '@/app/uiStore'
import { useTabs } from '@/app/tabsStore'
import { REPOSITORY_URL } from '@/app/about'
import { listPanels } from '@/app/registries'
import { registerBuiltinPanels } from '@/app/registerBuiltins'

registerBuiltinPanels()

export function ActivityRail() {
  const ui = useUi()
  const openSpecial = useTabs((s) => s.openSpecial)

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
      {listPanels().map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className="rail-btn"
          aria-label={label}
          title={label}
          aria-pressed={ui.sidePanel === id && ui.sidebarOpen}
          onClick={() => ui.setSidePanel(id)}
        >
          <Icon size={18} aria-hidden />
        </button>
      ))}
      <button
        className="rail-btn"
        aria-label="Graph view"
        title="Graph view"
        onClick={() => openSpecial('graph')}
      >
        <Waypoints size={18} aria-hidden />
      </button>
      <button
        className="rail-btn"
        aria-label="Calendar"
        title="Calendar"
        onClick={() => openSpecial('calendar')}
      >
        <CalendarRange size={18} aria-hidden />
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
        aria-label="neoma on GitHub (opens in new tab)"
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
