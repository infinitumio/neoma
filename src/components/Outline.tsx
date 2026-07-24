// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Heading outline — a right-side drawer listing the note's header hierarchy.
 * Headings nest by level and parents can be collapsed to hide their children.
 * Click a heading to jump to it (scrolls the reading view, or the editor to
 * that line). Toggled from the little outline button in the note toolbar.
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, X } from 'lucide-react'
import { parseOutline } from '@/utils/outline'

interface OutlineProps {
  path: string
  content: string
  open: boolean
  onClose: () => void
  /** Close after jumping (used on phones where the drawer overlays the note). */
  closeOnJump?: boolean
}

export function Outline({ path, content, open, onClose, closeOnJump }: OutlineProps) {
  const items = useMemo(() => parseOutline(content), [content])

  // Which headings have children (the next heading is deeper) — only these get
  // a caret and can be collapsed.
  const parentLines = useMemo(() => {
    const set = new Set<number>()
    for (let i = 0; i < items.length; i++) {
      if (items[i + 1] && items[i + 1].level > items[i].level) set.add(items[i].line)
    }
    return set
  }, [items])

  // Collapsed headings, keyed by line so the state survives content edits.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  // Reset collapse state when switching notes.
  useEffect(() => setCollapsed(new Set()), [path])

  const toggle = (line: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      return next
    })

  const allCollapsed = parentLines.size > 0 && collapsed.size >= parentLines.size
  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(parentLines))

  // Walk the flat list, hiding anything under a collapsed ancestor.
  const visible = useMemo(() => {
    const rows: { item: (typeof items)[number]; hasChildren: boolean; isCollapsed: boolean }[] = []
    let hideDeeperThan = Infinity
    for (const item of items) {
      if (item.level > hideDeeperThan) continue // hidden by a collapsed ancestor
      hideDeeperThan = Infinity
      const hasChildren = parentLines.has(item.line)
      const isCollapsed = hasChildren && collapsed.has(item.line)
      rows.push({ item, hasChildren, isCollapsed })
      if (isCollapsed) hideDeeperThan = item.level
    }
    return rows
  }, [items, parentLines, collapsed])

  const jump = (heading: string, slug: string, line: number) => {
    window.dispatchEvent(
      new CustomEvent('neoma:scroll-to-heading', { detail: { path, heading, slug, line } }),
    )
    if (closeOnJump) onClose()
  }

  return (
    <>
      {open && <button className="outline-backdrop" aria-label="Close outline" onClick={onClose} />}
      <aside
        className={`outline-drawer${open ? ' open' : ''}`}
        aria-label="Outline"
        aria-hidden={!open}
      >
        <div className="outline-head">
          <span>Outline</span>
          <div className="outline-head-actions">
            {parentLines.size > 0 && (
              <button
                className="icon-btn"
                aria-label={allCollapsed ? 'Expand all' : 'Collapse all'}
                title={allCollapsed ? 'Expand all' : 'Collapse all'}
                onClick={toggleAll}
              >
                {allCollapsed ? (
                  <ChevronsUpDown size={15} aria-hidden />
                ) : (
                  <ChevronsDownUp size={15} aria-hidden />
                )}
              </button>
            )}
            <button className="icon-btn" aria-label="Close outline" onClick={onClose}>
              <X size={15} aria-hidden />
            </button>
          </div>
        </div>
        <div className="outline-body">
          {items.length === 0 ? (
            <p className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
              No headings in this note.
            </p>
          ) : (
            visible.map(({ item, hasChildren, isCollapsed }) => (
              <div key={item.line} className={`outline-item outline-l${item.level}`}>
                {hasChildren ? (
                  <button
                    className={`outline-caret${isCollapsed ? ' collapsed' : ''}`}
                    aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
                    aria-expanded={!isCollapsed}
                    onClick={() => toggle(item.line)}
                  >
                    <ChevronDown size={14} aria-hidden />
                  </button>
                ) : (
                  <span className="outline-caret-spacer" aria-hidden />
                )}
                <button
                  className="outline-label"
                  onClick={() => jump(item.text, item.slug, item.line)}
                >
                  {item.text}
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  )
}
