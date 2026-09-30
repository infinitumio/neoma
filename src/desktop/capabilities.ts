// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useState } from 'react'
import { isDesktopApp } from './tauri'

export async function supportsDesktopUpdates(): Promise<boolean> {
  if (!isDesktopApp()) return false
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<boolean>('desktop_self_update_enabled')
}

/** null while loading; fail closed if native capabilities cannot be read. */
export function useDesktopUpdates(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    let active = true
    void supportsDesktopUpdates().then(
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
