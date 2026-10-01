// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Where the on-screen keyboard's top edge is, and whether it is up at all.
 *
 * DOM focus is not a usable proxy for "the keyboard is showing". The editor
 * calls `view.focus()` when it mounts, and iOS refuses to raise the keyboard
 * without a user gesture — so the editor routinely holds focus with no keyboard.
 * Anything positioned against the keyboard on that basis ends up parked at the
 * bottom of the screen, on top of the floating tab bar.
 *
 * The visual viewport is the honest signal: the keyboard is the only thing that
 * takes a large bite out of it in a fullscreen webview. `inset` is how far its
 * bottom edge sits above the layout viewport's, which is exactly the offset a
 * fixed element needs to rest on the keyboard.
 *
 * Deliberately reads the viewport itself rather than the --app-vh custom
 * property: App.tsx only maintains that inside the native shell, so relying on
 * it would leave the web app on a phone positioning against the screen bottom.
 */
import { useEffect, useState } from 'react'

const KEYBOARD_MIN_HEIGHT = 120

export interface KeyboardState {
  /** True while the keyboard occupies a meaningful part of the screen. */
  open: boolean
  /** Distance in px from the layout viewport's bottom to the keyboard's top. */
  inset: number
}

export function useKeyboardOpen(): KeyboardState {
  const [state, setState] = useState<KeyboardState>({ open: false, inset: 0 })

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - (vv.height + vv.offsetTop)))
      setState((prev) =>
        prev.inset === inset && prev.open === inset > KEYBOARD_MIN_HEIGHT
          ? prev
          : { open: inset > KEYBOARD_MIN_HEIGHT, inset },
      )
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return state
}
