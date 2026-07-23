// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Heading outline — a right-side drawer listing the note's header hierarchy.
 * Click a heading to jump to it (scrolls the reading view, or the editor to
 * that line). Toggled from the little outline button in the note toolbar.
 */
import { useMemo } from 'react'
import { X } from 'lucide-react'
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
          <button className="icon-btn" aria-label="Close outline" onClick={onClose}>
            <X size={15} aria-hidden />
          </button>
        </div>
        <div className="outline-body">
          {items.length === 0 ? (
            <p className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
              No headings in this note.
            </p>
          ) : (
            items.map((it, i) => (
              <button
                key={i}
                className={`outline-item outline-l${it.level}`}
                onClick={() => jump(it.text, it.slug, it.line)}
              >
                {it.text}
              </button>
            ))
          )}
        </div>
      </aside>
    </>
  )
}
