// SPDX-License-Identifier: AGPL-3.0-or-later
import 'fake-indexeddb/auto'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

// Both platform probes are module-level functions read at call time, so the
// mock can be re-pointed per test.
const tauri = vi.hoisted(() => ({ isDesktopApp: vi.fn(() => false) }))
vi.mock('@/desktop/tauri', () => ({
  isDesktopApp: tauri.isDesktopApp,
  isTauri: vi.fn(() => false),
  isMobileApp: vi.fn(() => false),
}))

import { supportsFolderVaults, openFolderVault } from '@/storage/VaultManager'

/** Chromium browsers expose this; WKWebView and WebKitGTK do not. */
function setDirectoryPicker(present: boolean) {
  if (present) {
    ;(window as unknown as Record<string, unknown>).showDirectoryPicker = vi.fn()
  } else {
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker
  }
}

describe('supportsFolderVaults', () => {
  beforeEach(() => {
    tauri.isDesktopApp.mockReturnValue(false)
    setDirectoryPicker(false)
  })
  afterEach(() => {
    vi.clearAllMocks()
    setDirectoryPicker(false)
  })

  it('is true in a Chromium browser, which has the File System Access API', () => {
    setDirectoryPicker(true)
    expect(supportsFolderVaults()).toBe(true)
  })

  it('is true in the desktop app, which has Tauri’s native picker', () => {
    tauri.isDesktopApp.mockReturnValue(true)
    expect(supportsFolderVaults()).toBe(true)
  })

  it('is false in the phone app, which has neither picker', () => {
    // The iOS shell is Tauri but not *desktop* Tauri: WKWebView ships no File
    // System Access API, and tauri-plugin-dialog compiles its folder picker
    // desktop-only (mobile returns FolderPickerNotImplemented). Offering the
    // action anyway dead-ends in an error toast — an App Store 2.1 rejection.
    expect(supportsFolderVaults()).toBe(false)
  })

  it('is false in a non-Chromium browser', () => {
    expect(supportsFolderVaults()).toBe(false)
  })
})

describe('openFolderVault', () => {
  beforeEach(() => {
    tauri.isDesktopApp.mockReturnValue(false)
    setDirectoryPicker(false)
  })
  afterEach(() => {
    vi.clearAllMocks()
    setDirectoryPicker(false)
  })

  it('refuses rather than silently doing nothing where no picker exists', async () => {
    await expect(openFolderVault()).rejects.toThrow(/does not support opening local folders/)
  })

  it('routes to the native picker in the desktop app, not the web API', async () => {
    // Regression: the vault switcher called the File System Access path
    // unconditionally, so "Open a folder" threw in every Tauri build.
    // Make the web API *available* so the assertion can only pass if the
    // native branch was chosen deliberately, not by absence of the fallback.
    setDirectoryPicker(true)
    tauri.isDesktopApp.mockReturnValue(true)
    const webPicker = window.showDirectoryPicker as unknown as ReturnType<typeof vi.fn>

    // The Tauri dialog import cannot resolve outside the shell; that rejection
    // is itself proof the native branch ran.
    await openFolderVault().catch(() => undefined)

    expect(webPicker).not.toHaveBeenCalled()
  })
})
