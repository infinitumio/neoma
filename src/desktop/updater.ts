// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Desktop in-app auto-update. When the desktop app is online it can check the
 * GitHub release feed for a newer signed build, download it, and relaunch into
 * it. The plugin modules are imported lazily so nothing loads on the web or on
 * iOS (where updates come through the App Store).
 */
import { isDesktopApp } from './tauri'

export interface DesktopUpdate {
  version: string
  currentVersion: string
  notes?: string
  /** Download, install, and relaunch into the new version. */
  install: (onProgress?: (fraction: number | null) => void) => Promise<void>
}

/** Returns update info if a newer signed build is available, else null. */
export async function checkForDesktopUpdate(): Promise<DesktopUpdate | null> {
  if (!isDesktopApp()) return null
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  if (!update) return null

  return {
    version: update.version,
    currentVersion: update.currentVersion,
    notes: update.body,
    install: async (onProgress) => {
      let total = 0
      let received = 0
      await update.downloadAndInstall((event) => {
        if (!onProgress) return
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0
          onProgress(total ? 0 : null)
        } else if (event.event === 'Progress') {
          received += event.data.chunkLength
          onProgress(total ? received / total : null)
        } else if (event.event === 'Finished') {
          onProgress(1)
        }
      })
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    },
  }
}
