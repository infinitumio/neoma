// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, afterEach, vi } from 'vitest'
import { isMobileApp, isDesktopApp } from '@/desktop/tauri'

/** Pose as a given platform: Tauri presence, user agent and touch points. */
function pose(opts: { tauri: boolean; ua: string; touch: number }) {
  if (opts.tauri) {
    ;(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {}
  } else {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
  }
  // jsdom's navigator defines neither as configurable spies, so define them.
  Object.defineProperty(navigator, 'userAgent', { value: opts.ua, configurable: true })
  Object.defineProperty(navigator, 'maxTouchPoints', { value: opts.touch, configurable: true })
}

const IPAD_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)'
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
const WIN_TOUCH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120'

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__
})

describe('isMobileApp', () => {
  it('detects iPhone from the user agent', () => {
    pose({ tauri: true, ua: IPHONE_UA, touch: 5 })
    expect(isMobileApp()).toBe(true)
  })

  it('detects iPad despite its desktop user agent', () => {
    // Verified on an iPad Pro 11 simulator: iPadOS WKWebView reports a
    // Macintosh UA with no "iPad" in it, so UA matching alone missed every
    // iPad and isDesktopApp() then claimed the iPad was a desktop.
    pose({ tauri: true, ua: IPAD_UA, touch: 5 })
    expect(isMobileApp()).toBe(true)
    expect(isDesktopApp()).toBe(false)
  })

  it('still treats a real Mac as a desktop', () => {
    pose({ tauri: true, ua: MAC_UA, touch: 0 })
    expect(isMobileApp()).toBe(false)
    expect(isDesktopApp()).toBe(true)
  })

  it('does not mistake a Windows touchscreen laptop for a phone', () => {
    pose({ tauri: true, ua: WIN_TOUCH_UA, touch: 10 })
    expect(isMobileApp()).toBe(false)
    expect(isDesktopApp()).toBe(true)
  })

  it('is false in a plain browser, Tauri or not', () => {
    pose({ tauri: false, ua: IPAD_UA, touch: 5 })
    expect(isMobileApp()).toBe(false)
    expect(isDesktopApp()).toBe(false)
  })
})
