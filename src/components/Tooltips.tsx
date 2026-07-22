// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Lightweight global hover tooltips for toolbar/sidebar controls. Sources the
 * label from `data-tooltip`, `aria-label` or `title` on any control inside an
 * opted-in region (activity rail, sidebars, PDF viewer). A single portal node
 * is reused, positioned above the target (flipping below when tight). Native
 * `title` tooltips are suppressed while shown so they don't double up. The
 * whole feature is gated on the `showTooltips` setting.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSettings } from '@/settings/settingsStore'

// Tooltips are for icon-only controls in the rail, sidebars and PDF viewer.
// The icon-only rule below excludes text entries (e.g. file-tree pages), so
// page-navigation items that already show a label never get a tooltip.
const REGION = '.activity-rail, .sidebar, .right-sidebar, .pdf-viewer'
const SHOW_DELAY = 450

/** An icon-only control (no visible text, not a form field) — the only kind
 *  that benefits from a tooltip. */
function isIconOnly(el: HTMLElement): boolean {
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return false
  return (el.textContent ?? '').trim() === ''
}

interface TipState {
  text: string
  x: number
  y: number
  side: 'top' | 'bottom' | 'right'
}

export function Tooltips() {
  const enabled = useSettings((s) => s.settings.showTooltips)
  const [tip, setTip] = useState<TipState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restore = useRef<{ el: HTMLElement; title: string } | null>(null)

  useEffect(() => {
    if (!enabled) {
      setTip(null)
      return
    }

    const clear = () => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      // Restore any suppressed native title.
      if (restore.current) {
        restore.current.el.setAttribute('title', restore.current.title)
        restore.current = null
      }
      setTip(null)
    }

    const labelFor = (source: HTMLElement): string | null => {
      const text =
        source.dataset.tooltip ||
        source.getAttribute('aria-label') ||
        source.getAttribute('title') ||
        ''
      if (!text.trim()) return null
      // Suppress the native title tooltip while ours is shown.
      const title = source.getAttribute('title')
      if (title) {
        restore.current = { el: source, title }
        source.removeAttribute('title')
      }
      return text.trim()
    }

    const onOver = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      const target = e.target as HTMLElement | null
      // Only real controls get tooltips — never containers/landmarks (so
      // hovering empty sidebar/rail space shows nothing).
      const source = target?.closest<HTMLElement>('button, [role="button"], a[href], [data-tooltip]')
      if (!source || !source.closest(REGION) || !isIconOnly(source)) {
        clear()
        return
      }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        const text = labelFor(source)
        if (!text) return
        const r = source.getBoundingClientRect()
        // Vertical rail (and the icon rail) read best with the label to the
        // right of the button; horizontal toolbars use above/below.
        if (source.closest('.activity-rail')) {
          setTip({ text, x: Math.round(r.right + 8), y: Math.round(r.top + r.height / 2), side: 'right' })
          return
        }
        const below = r.top < 44
        const centre = r.left + r.width / 2
        setTip({
          text,
          // Keep the (centre-anchored) tooltip clear of the viewport edges.
          x: Math.round(Math.max(80, Math.min(centre, window.innerWidth - 80))),
          y: below ? Math.round(r.bottom + 6) : Math.round(r.top - 6),
          side: below ? 'bottom' : 'top',
        })
      }, SHOW_DELAY)
    }

    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerdown', clear, true)
    window.addEventListener('scroll', clear, true)
    window.addEventListener('blur', clear)
    return () => {
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerdown', clear, true)
      window.removeEventListener('scroll', clear, true)
      window.removeEventListener('blur', clear)
      clear()
    }
  }, [enabled])

  if (!tip) return null
  return createPortal(
    <div className={`tooltip tooltip-${tip.side}`} role="tooltip" style={{ left: tip.x, top: tip.y }}>
      {tip.text}
    </div>,
    document.body,
  )
}
