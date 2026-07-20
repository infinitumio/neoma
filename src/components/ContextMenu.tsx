// SPDX-License-Identifier: AGPL-3.0-or-later
/** Accessible context menu rendered at a fixed position. */
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export interface MenuItem {
  label: string
  icon?: ReactNode
  danger?: boolean
  separatorAfter?: boolean
  onSelect: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const menu = ref.current
    if (!menu) return
    // Keep the menu on screen.
    const rect = menu.getBoundingClientRect()
    if (rect.right > window.innerWidth) menu.style.left = `${Math.max(4, x - rect.width)}px`
    if (rect.bottom > window.innerHeight) menu.style.top = `${Math.max(4, y - rect.height)}px`
    menu.querySelector<HTMLElement>('button')?.focus()

    const onPointerDown = (event: MouseEvent) => {
      if (!menu.contains(event.target as Node)) onClose()
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('blur', onClose)
    }
  }, [x, y, onClose])

  const onKeyDown = (event: React.KeyboardEvent) => {
    const buttons = [...(ref.current?.querySelectorAll<HTMLElement>('button') ?? [])]
    const index = buttons.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') onClose()
    else if (event.key === 'ArrowDown') {
      event.preventDefault()
      buttons[(index + 1) % buttons.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      buttons[(index - 1 + buttons.length) % buttons.length]?.focus()
    }
  }

  return createPortal(
    <div
      ref={ref}
      className="context-menu"
      style={{ left: x, top: y }}
      role="menu"
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <div key={i}>
          <button
            role="menuitem"
            className={item.danger ? 'danger' : undefined}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            {item.icon}
            {item.label}
          </button>
          {item.separatorAfter && <div className="menu-separator" role="separator" />}
        </div>
      ))}
    </div>,
    document.body,
  )
}
