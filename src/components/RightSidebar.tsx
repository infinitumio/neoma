// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Right contextual sidebar: outline, backlinks, properties and note info
 * for the active note. Optional and collapsible; a sheet on small screens.
 */
import { List, Link2, Info, SlidersHorizontal, X } from 'lucide-react'
import { useUi, type RightPanelId } from '@/app/uiStore'
import { useVault, subpagesOf } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { stem } from '@/utils/paths'
import { BacklinksContent, useActiveNotePath } from './panels/BacklinksPanel'
import { scrollToHeading } from '@/app/navigation'
import { friendlyDateTime } from '@/utils/dates'

const TABS: Array<{ id: RightPanelId; label: string; icon: typeof List }> = [
  { id: 'outline', label: 'Outline', icon: List },
  { id: 'backlinks', label: 'Backlinks', icon: Link2 },
  { id: 'properties', label: 'Properties', icon: SlidersHorizontal },
  { id: 'info', label: 'Note info', icon: Info },
]

export function RightSidebar() {
  const open = useUi((s) => s.rightSidebarOpen)
  const panel = useUi((s) => s.rightPanel)
  const ui = useUi()
  const path = useActiveNotePath()
  const meta = useVault((s) => (path ? s.metas.get(path) : undefined))
  useVault((s) => s.metaVersion)

  if (!open) return null

  return (
    <aside className={`right-sidebar${open ? ' open' : ''}`} aria-label="Note context">
      <div className="right-tabs" role="tablist" aria-label="Context panels">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={panel === id}
            className="right-tab"
            aria-label={label}
            title={label}
            onClick={() => ui.setRightPanel(id)}
          >
            <Icon size={15} aria-hidden />
          </button>
        ))}
        <button
          className="right-tab"
          onClick={ui.toggleRightSidebar}
          aria-label="Close context sidebar"
        >
          <X size={15} aria-hidden />
        </button>
      </div>
      <div className="right-body">
        {!path || !meta ? (
          <p className="text-small text-faint">Open a note to see its context.</p>
        ) : (
          <>
            {panel === 'outline' && (
              <div aria-label="Note outline">
                <SubpagesList path={path} />
                {meta.headings.length === 0 && (
                  <p className="text-small text-faint">No headings in this page.</p>
                )}
                {meta.headings.map((heading, i) => (
                  <button
                    key={i}
                    className="outline-item"
                    style={{ paddingLeft: `${(heading.depth - 1) * 0.75 + 0.5}rem` }}
                    onClick={() => scrollToHeading(path, heading.text)}
                  >
                    {heading.text}
                  </button>
                ))}
              </div>
            )}
            {panel === 'backlinks' && <BacklinksContent path={path} />}
            {panel === 'properties' && (
              <table className="props-table" aria-label="Frontmatter properties">
                <tbody>
                  {Object.entries(meta.frontmatter).length === 0 && (
                    <tr>
                      <td className="text-faint">
                        No properties. Add YAML frontmatter at the top of the note.
                      </td>
                    </tr>
                  )}
                  {Object.entries(meta.frontmatter).map(([key, value]) => (
                    <tr key={key}>
                      <th scope="row">{key}</th>
                      <td>
                        {Array.isArray(value)
                          ? value.map(String).join(', ')
                          : value instanceof Date
                            ? value.toISOString().slice(0, 10)
                            : String(value ?? '')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {panel === 'info' && (
              <table className="props-table" aria-label="Note information">
                <tbody>
                  <tr>
                    <th scope="row">Path</th>
                    <td>{meta.path}</td>
                  </tr>
                  <tr>
                    <th scope="row">Words</th>
                    <td>{meta.wordCount.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <th scope="row">Characters</th>
                    <td>{meta.charCount.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <th scope="row">Created</th>
                    <td>{friendlyDateTime(meta.createdAt)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Modified</th>
                    <td>{friendlyDateTime(meta.modifiedAt)}</td>
                  </tr>
                  <tr>
                    <th scope="row">Tags</th>
                    <td>{meta.tags.map((t) => `#${t}`).join(' ') || '—'}</td>
                  </tr>
                  {meta.citations.length > 0 && (
                    <tr>
                      <th scope="row">Citations</th>
                      <td>{meta.citations.map((c) => `[@${c}]`).join(' ')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </aside>
  )
}

function SubpagesList({ path }: { path: string }) {
  const openNote = useTabs((s) => s.openNote)
  useVault((s) => s.entries)
  const subpages = subpagesOf(path)
  if (!subpages.length) return null
  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <div className="sidebar-section-label">Subpages ({subpages.length})</div>
      {subpages.map((sub) => (
        <button key={sub} className="outline-item" onClick={() => openNote(sub)}>
          {stem(sub)}
        </button>
      ))}
    </div>
  )
}
