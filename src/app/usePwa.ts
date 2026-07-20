// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * PWA lifecycle: service-worker registration, update-available notification
 * and the (optional) install prompt. Uses vite-plugin-pwa's virtual module.
 */
import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

let updateSWCallback: ((reload?: boolean) => Promise<void>) | null = null
const listeners = new Set<(value: boolean) => void>()
let updateAvailableFlag = false
let registered = false

function ensureRegistered(): void {
  if (registered || typeof window === 'undefined') return
  registered = true
  try {
    updateSWCallback = registerSW({
      immediate: true,
      onNeedRefresh() {
        updateAvailableFlag = true
        listeners.forEach((listener) => listener(true))
      },
      onOfflineReady() {
        // Cached and ready for offline use. No banner needed — offline is
        // the normal state; the status bar reflects connectivity quietly.
      },
    })
  } catch {
    // Service workers unavailable (e.g. unsupported browser): app still runs.
  }
}

export function usePwa() {
  const [updateAvailable, setUpdateAvailable] = useState(updateAvailableFlag)

  useEffect(() => {
    ensureRegistered()
    listeners.add(setUpdateAvailable)
    return () => {
      listeners.delete(setUpdateAvailable)
    }
  }, [])

  return {
    updateAvailable,
    applyUpdate: async () => {
      if (updateSWCallback) await updateSWCallback(true)
    },
  }
}

/** Install-prompt support (Chromium). */
let deferredInstallEvent: (Event & { prompt: () => Promise<void> }) | null = null
const installListeners = new Set<(canInstall: boolean) => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredInstallEvent = event as Event & { prompt: () => Promise<void> }
    installListeners.forEach((listener) => listener(true))
  })
  window.addEventListener('appinstalled', () => {
    deferredInstallEvent = null
    installListeners.forEach((listener) => listener(false))
  })
}

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(deferredInstallEvent !== null)
  useEffect(() => {
    installListeners.add(setCanInstall)
    return () => {
      installListeners.delete(setCanInstall)
    }
  }, [])
  return {
    canInstall,
    promptInstall: async () => {
      if (deferredInstallEvent) {
        await deferredInstallEvent.prompt()
        deferredInstallEvent = null
        setCanInstall(false)
      }
    },
  }
}
