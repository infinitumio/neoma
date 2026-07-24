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
  MoreHorizontal,
  X,
} from 'lucide-react'
import { useUi } from '@/app/uiStore'
import { useTabs } from '@/app/tabsStore'
import { REPOSITORY_URL } from '@/app/about'
import { listPanels } from '@/app/registries'
import { registerBuiltinPanels } from '@/app/registerBuiltins'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useSheetDrag } from '@/hooks/useSheetDrag'

registerBuiltinPanels()

const GROUP_LABELS: Record<string, string> = { planner: 'Planner' }

/** The panels promoted to bottom-bar tabs on phones (iOS-style, ≤5 items). */
const MOBILE_TABS = ['files', 'search', 'calendar', 'study'] as const

/**
 * iOS-style bottom tab bar. The four most-used panels are tabs; everything else
 * (other panels, graph, help, settings) lives behind a "More" sheet, so we stay
 * within the ~5-item convention instead of a cramped left rail.
 */
function MobileTabBar() {
  const ui = useUi()
  const openSpecial = useTabs((s) => s.openSpecial)
  const [moreOpen, setMoreOpen] = useState(false)
  const panels = listPanels()
  const panel = (id: string) => panels.find((p) => p.id === id)
  const drag = useSheetDrag<HTMLDivElement>({
    onClose: () => setMoreOpen(false),
    direction: 'down',
    enabled: moreOpen,
  })

  const openPanel = (id: string) => {
    ui.setSidePanel(id as Parameters<typeof ui.setSidePanel>[0])
    setMoreOpen(false)
  }

  // "More" destinations: every panel not on the tab bar, then Graph.
  const morePanels = panels.filter((p) => !MOBILE_TABS.includes(p.id as never))

  return (
    <>
      <nav className="activity-rail activity-rail-bottom" aria-label="Primary">
        {MOBILE_TABS.map((id) => {
          const p = panel(id)
          if (!p) return null
          const Icon = p.icon
          const active = ui.sidePanel === id && ui.sidebarOpen
          return (
            <button
              key={id}
              className={`tab-btn${active ? ' active' : ''}`}
              aria-label={p.label}
              title={p.label}
              aria-pressed={active}
              onClick={() => ui.setSidePanel(id)}
            >
              <Icon size={22} aria-hidden />
            </button>
          )
        })}
        <button
          className={`tab-btn${moreOpen ? ' active' : ''}`}
          aria-label="More"
          title="More"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <MoreHorizontal size={22} aria-hidden />
        </button>
      </nav>

      {moreOpen && (
        <>
          <button
            className="more-sheet-backdrop"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
          <div className="more-sheet" role="dialog" aria-label="More" ref={drag.ref}>
            <div
              className="more-sheet-grabber"
              onTouchStart={drag.onTouchStart}
              onTouchMove={drag.onTouchMove}
              onTouchEnd={drag.onTouchEnd}
            >
              <div className="more-sheet-handle" aria-hidden />
            </div>
            <div className="more-sheet-grid">
              {morePanels.map((p) => {
                const Icon = p.icon
                return (
                  <button key={p.id} className="more-item" onClick={() => openPanel(p.id)}>
                    <Icon size={22} aria-hidden />
                    <span>{p.label}</span>
                  </button>
                )
              })}
              <button
                className="more-item"
                onClick={() => {
                  openSpecial('graph')
                  setMoreOpen(false)
                }}
              >
                <Waypoints size={22} aria-hidden />
                <span>Graph</span>
              </button>
              <button
                className="more-item"
                onClick={() => {
                  ui.setHelpOpen(true)
                  setMoreOpen(false)
                }}
              >
                <HelpCircle size={22} aria-hidden />
                <span>Help</span>
              </button>
              <button
                className="more-item"
                onClick={() => {
                  ui.setSettingsOpen(true)
                  setMoreOpen(false)
                }}
              >
                <Settings size={22} aria-hidden />
                <span>Settings</span>
              </button>
            </div>
            <button className="btn more-sheet-close" onClick={() => setMoreOpen(false)}>
              <X size={16} aria-hidden /> Close
            </button>
          </div>
        </>
      )}
    </>
  )
}

export function ActivityRail() {
  const ui = useUi()
  const openSpecial = useTabs((s) => s.openSpecial)
  const isMobile = useIsMobile()
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  // Phones get an iOS-style bottom tab bar instead of the left rail.
  if (isMobile) return <MobileTabBar />

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
