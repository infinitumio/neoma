// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'react'
import { isDesktopApp } from './tauri'

export async function supportsDesktopUpdates(): Promise<boolean> {
  if (!isDesktopApp()) return false
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<boolean>('desktop_updater_available')
}

/** null while loading; fail closed if native capabilities cannot be read. */
export function useDesktopUpdates(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    let active = true
    void import('@tauri-apps/api/core')
      .then(({ invoke }) =>
        isDesktopApp() ? invoke<boolean>('desktop_self_update_enabled') : false,
      )
      .then(
        (value) => {
          if (active) setEnabled(value)
        },
        () => {
          if (active) setEnabled(false)
        },
      )
    return () => {
      active = false
    }
  }, [])
  return enabled
}

/** Whether this installation supports replacing its own executable. */
export function useDesktopUpdaterAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null)
  useEffect(() => {
    let active = true
    void supportsDesktopUpdates().then(
      (value) => {
        if (active) setAvailable(value)
      },
      () => {
        if (active) setAvailable(false)
      },
    )
    return () => {
      active = false
    }
  }, [])
  return available
}
