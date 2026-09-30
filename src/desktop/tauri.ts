// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Desktop (Tauri) integration. Everything here is a no-op in the browser/PWA
 * build: each entry point is guarded by `isTauri()` and loads the Tauri
 * packages via dynamic `import()`, so they are never bundled into or executed
 * for the web build. The web app remains the single source of truth — this
 * only adds native window/tray behaviour. See src-tauri/ and DESKTOP.md.
 */
import { useUi } from '@/app/uiStore'
import { flushAllSaves, reportSaveError } from '@/app/vaultStore'

/** How closing the main window behaves in the desktop app. */
export type CloseBehavior = 'quit' | 'tray' | 'ask'

/** Numeric codes shared with the Rust close handler (see src-tauri/src/lib.rs). */
const BEHAVIOR_CODE: Record<CloseBehavior, number> = { quit: 0, tray: 1, ask: 2 }

/** True when running inside the Tauri native shell (desktop or mobile). */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * True in the native mobile app (iOS/iPadOS/Android).
 *
 * iPadOS 13+ reports a *desktop* user agent inside WKWebView — verified on an
 * iPad Pro 11 simulator: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)
 * AppleWebKit/605.1.15`, with no "iPad" anywhere. Matching the UA alone
 * therefore missed every iPad, and because `isDesktopApp()` is defined as "Tauri
 * and not mobile", an iPad claimed to *be* a desktop. That handed it the
 * desktop-only folder picker (which returns FolderPickerNotImplemented on
 * mobile), the `<a download>` export path (which wry cancels), and none of the
 * touch scroll-lock or keyboard viewport handling.
 *
 * A Mac reports no touch points; iPadOS reports 5. Requiring an Apple desktop UA
 * *and* touch keeps Windows/Linux touchscreen laptops on the desktop layout.
 */
export function isMobileApp(): boolean {
  if (!isTauri() || typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iphone|ipad|ipod|android/i.test(ua)) return true
  return /Macintosh|Mac OS X/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1
}

/**
 * True only in the desktop app (not iOS/Android). Tray, launch-on-startup and
 * close-to-tray are desktop concepts and are compiled out of the mobile shell.
 */
export function isDesktopApp(): boolean {
  return isTauri() && !isMobileApp()
}

/** Push the close/tray preference down to the native window handler. */
export async function syncCloseBehavior(behavior: CloseBehavior): Promise<void> {
  if (!isDesktopApp()) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('set_close_behavior', { behavior: BEHAVIOR_CODE[behavior] })
  } catch {
    /* native command unavailable — non-fatal */
  }
}

/** Enable or disable launch-on-login. */
export async function setLaunchOnStartup(enabled: boolean): Promise<void> {
  if (!isDesktopApp()) return
  try {
    const { enable, disable } = await import('@tauri-apps/plugin-autostart')
    if (enabled) await enable()
    else await disable()
  } catch {
    /* non-fatal */
  }
}

/** Whether launch-on-login is currently enabled (false off-desktop). */
export async function isLaunchOnStartupEnabled(): Promise<boolean> {
  if (!isDesktopApp()) return false
  try {
    const { isEnabled } = await import('@tauri-apps/plugin-autostart')
    return await isEnabled()
  } catch {
    return false
  }
}

/**
 * Initialise native integration once at startup: apply the current close
 * preference and wire the "ask on close" flow (the Rust side prevents the
 * close and emits an event; we show the in-app confirm and quit if accepted).
 * Returns a cleanup function. A no-op in the browser.
 */
export async function initDesktopIntegration(
  getBehavior: () => CloseBehavior,
): Promise<() => void> {
  if (!isDesktopApp()) return () => {}
  await syncCloseBehavior(getBehavior())
  try {
    const { listen } = await import('@tauri-apps/api/event')
    let quitting = false
    const saveAndQuit = async () => {
      if (quitting) return
      quitting = true
      try {
        await flushAllSaves()
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('quit_app')
      } catch (error) {
        reportSaveError(error)
      } finally {
        quitting = false
      }
    }
    const unlistenSave = await listen('neoma://save-and-quit', () => void saveAndQuit())
    let unlisten: () => void
    try {
      unlisten = await listen('neoma://close-requested', () => {
        useUi.getState().askConfirm({
          title: 'Quit neoma?',
          message: 'Quit completely, or keep neoma running in the tray?',
          confirmLabel: 'Quit',
          onConfirm: saveAndQuit,
        })
      })
    } catch (error) {
      unlistenSave()
      throw error
    }
    return () => {
      unlisten()
      unlistenSave()
    }
  } catch {
    return () => {}
  }
}
