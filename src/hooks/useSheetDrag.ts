// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Drag-to-dismiss for iOS-style sheets and drawers. Attach the returned `ref`
 * and touch handlers to the panel element (or, for a sheet, its grab handle).
 * Dragging in the dismiss direction moves the panel with the finger; releasing
 * past a distance/velocity threshold slides it the rest of the way out and
 * calls `onClose`, otherwise it springs back. Dragging the "wrong" way is
 * heavily damped so the panel feels anchored.
 *
 * The transform is written straight to the DOM (no React re-render per frame)
 * so it tracks the finger at 60fps. When idle we clear the inline transform so
 * the element's CSS `.open` transition owns the resting/slide-in state.
 */
import { useEffect, useRef, type TouchEvent } from 'react'

type Direction = 'down' | 'left' | 'right'

const SPRING = 'cubic-bezier(0.32, 0.72, 0, 1)' // iOS sheet curve
const DISTANCE = 64 // px past which a release dismisses
const VELOCITY = 0.5 // px/ms flick that dismisses regardless of distance

// The fully-dismissed transform per direction — matches each panel's CSS closed
// state so handing control back to CSS after dismissal doesn't visibly jump.
const CLOSED: Record<Direction, string> = {
  down: 'translateY(100%)',
  left: 'translateX(-100%)',
  right: 'translateX(100%)',
}

export function useSheetDrag<T extends HTMLElement>({
  onClose,
  direction,
  enabled = true,
}: {
  onClose: () => void
  direction: Direction
  enabled?: boolean
}) {
  const ref = useRef<T>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const startTime = useRef(0)
  const offset = useRef(0)
  const active = useRef(false)
  // null = axis not yet decided; false = aborted (gesture is scrolling instead).
  const locked = useRef<boolean | null>(null)

  const axis: 'x' | 'y' = direction === 'down' ? 'y' : 'x'
  const sign = direction === 'left' ? -1 : 1 // dismissing pushes this way

  const paint = (v: number) => {
    const el = ref.current
    if (!el) return
    el.style.transition = 'none'
    el.style.transform = axis === 'y' ? `translateY(${v}px)` : `translateX(${v}px)`
  }

  const onTouchStart = (e: TouchEvent) => {
    if (!enabled || e.touches.length !== 1) return
    active.current = true
    locked.current = null
    offset.current = 0
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    startTime.current = e.timeStamp
  }

  const onTouchMove = (e: TouchEvent) => {
    if (!active.current) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    // Decide once whether this gesture is a dismiss drag or a scroll. If the
    // dominant axis isn't ours, bail so the inner content scrolls normally.
    if (locked.current === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      const along = axis === 'y' ? Math.abs(dy) > Math.abs(dx) : Math.abs(dx) > Math.abs(dy)
      locked.current = along
      if (!along) {
        active.current = false
        return
      }
    }
    let d = axis === 'y' ? dy : dx
    // Only travel freely toward the dismiss direction; damp the other way.
    if (sign * d < 0) d /= 5
    offset.current = d
    paint(d)
  }

  const onTouchEnd = (e: TouchEvent) => {
    if (!active.current) return
    active.current = false
    const el = ref.current
    const d = offset.current
    const dt = Math.max(1, e.timeStamp - startTime.current)
    const velocity = d / dt
    const dismiss = sign * d > DISTANCE || sign * velocity > VELOCITY
    if (!el) {
      if (dismiss) onClose()
      return
    }
    if (dismiss) {
      // Finish the throw to the closed position, then close. We deliberately
      // leave the inline transform in place — it equals the CSS closed state,
      // so there's no jump — and the effect below clears it on the next open.
      el.style.transition = `transform 240ms ${SPRING}`
      el.style.transform = CLOSED[direction]
      const done = () => {
        el.removeEventListener('transitionend', done)
        onClose()
      }
      el.addEventListener('transitionend', done)
    } else {
      // Spring back to rest; hand control back to the CSS `.open` state.
      el.style.transition = `transform 320ms ${SPRING}`
      el.style.transform = ''
      const clear = () => {
        el.removeEventListener('transitionend', clear)
        el.style.transition = ''
      }
      el.addEventListener('transitionend', clear)
    }
  }

  // On (re)open, wipe any inline transform a previous dismissal left behind so
  // the element isn't stuck off-screen and the CSS `.open` slide-in can run.
  useEffect(() => {
    const el = ref.current
    if (enabled && el) {
      el.style.transition = ''
      el.style.transform = ''
    }
  }, [enabled])

  return { ref, onTouchStart, onTouchMove, onTouchEnd }
}
