// SPDX-License-Identifier: AGPL-3.0-or-later
/** Small popover of page-colour swatches, used to colour a page or file. */
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { PAGE_COLORS, type PageColor } from '@/utils/colors'

interface ColorPickerProps {
  current: PageColor | null
  onPick: (color: PageColor | null) => void
  onClose: () => void
}

export function ColorPicker({ current, onPick, onClose }: ColorPickerProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div ref={ref} className="color-picker" role="group" aria-label="Page colour">
      {PAGE_COLORS.map((color) => (
        <button
          key={color}
          className={`color-swatch${current === color ? ' selected' : ''}`}
          style={{ background: `var(--pc-${color})` }}
          aria-label={color}
          aria-pressed={current === color}
          title={color}
          onClick={() => {
            onPick(color)
            onClose()
          }}
        />
      ))}
      <button
        className="color-swatch color-clear"
        aria-label="No colour"
        title="No colour"
        onClick={() => {
          onPick(null)
          onClose()
        }}
      >
        <X size={11} aria-hidden />
      </button>
    </div>
  )
}
