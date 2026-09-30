// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKeyboardOpen } from '@/hooks/useKeyboardOpen'

/** Stand in for visualViewport, which jsdom does not implement. */
function setViewport(height: number, offsetTop = 0) {
  const listeners: Record<string, (() => void)[]> = {}
  const vv = {
    height,
    offsetTop,
    addEventListener: (t: string, fn: () => void) => {
      ;(listeners[t] ??= []).push(fn)
    },
    removeEventListener: () => {},
    dispatchEvent: (e: Event) => {
      listeners[e.type]?.forEach((fn) => fn())
      return true
    },
  }
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 660, configurable: true })
  return vv
}

describe('useKeyboardOpen', () => {
  beforeEach(() => Object.defineProperty(window, 'innerHeight', { value: 660, configurable: true }))
  afterEach(() => vi.restoreAllMocks())

  it('is closed when the viewport fills the screen', () => {
    setViewport(660)
    const { result } = renderHook(() => useKeyboardOpen())
    expect(result.current.open).toBe(false)
    expect(result.current.inset).toBe(0)
  })

  it('is open, with the keyboard height, when the viewport shrinks', () => {
    setViewport(360)
    const { result } = renderHook(() => useKeyboardOpen())
    expect(result.current.open).toBe(true)
    expect(result.current.inset).toBe(300)
  })

  it('ignores a bite too small to be a keyboard', () => {
    // A focused editor with no keyboard is the case that put the bar on top of
    // the tab bar; only a keyboard-sized inset should count.
    setViewport(600)
    const { result } = renderHook(() => useKeyboardOpen())
    expect(result.current.open).toBe(false)
  })

  it('reacts when the keyboard appears', () => {
    const vv = setViewport(660)
    const { result } = renderHook(() => useKeyboardOpen())
    expect(result.current.open).toBe(false)
    act(() => {
      vv.height = 360
      vv.dispatchEvent(new Event('resize'))
    })
    expect(result.current.open).toBe(true)
    expect(result.current.inset).toBe(300)
  })
})
