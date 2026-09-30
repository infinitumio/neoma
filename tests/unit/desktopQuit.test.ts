// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  flush: vi.fn(),
  report: vi.fn(),
  invoke: vi.fn(),
  confirm: vi.fn(),
  listeners: new Map<string, () => void>(),
}))
vi.mock('@/app/vaultStore', () => ({ flushAllSaves: mocks.flush, reportSaveError: mocks.report }))
vi.mock('@/app/uiStore', () => ({ useUi: { getState: () => ({ askConfirm: mocks.confirm }) } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (name, callback) => {
    mocks.listeners.set(name, callback)
    return () => mocks.listeners.delete(name)
  }),
}))
import { initDesktopIntegration } from '@/desktop/tauri'
import { supportsDesktopUpdates } from '@/desktop/capabilities'

describe('desktop quit saves', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listeners.clear()
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true })
    mocks.flush.mockResolvedValue(undefined)
    mocks.invoke.mockResolvedValue(undefined)
  })
  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
  })
  it('waits for saves before exiting and ignores duplicate quit requests', async () => {
    let finish!: () => void
    mocks.flush.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve
      }),
    )
    const cleanup = await initDesktopIntegration(() => 'quit')
    mocks.listeners.get('neoma://save-and-quit')!()
    mocks.listeners.get('neoma://save-and-quit')!()
    expect(mocks.flush).toHaveBeenCalledTimes(1)
    expect(mocks.invoke).not.toHaveBeenCalledWith('quit_app')
    finish()
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('quit_app'))
    cleanup()
    expect(mocks.listeners.size).toBe(0)
  })
  it('keeps the app open after a failed save and allows retry', async () => {
    const error = new Error('Disk full')
    mocks.flush.mockRejectedValueOnce(error)
    await initDesktopIntegration(() => 'quit')
    mocks.listeners.get('neoma://save-and-quit')!()
    await vi.waitFor(() => expect(mocks.report).toHaveBeenCalledWith(error))
    expect(mocks.invoke).not.toHaveBeenCalledWith('quit_app')
    mocks.listeners.get('neoma://save-and-quit')!()
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('quit_app'))
  })
  it('uses the same save path after the ask-on-close confirmation', async () => {
    await initDesktopIntegration(() => 'ask')
    mocks.listeners.get('neoma://close-requested')!()
    expect(mocks.flush).not.toHaveBeenCalled()
    await mocks.confirm.mock.calls[0][0].onConfirm()
    expect(mocks.flush).toHaveBeenCalledTimes(1)
    expect(mocks.invoke).toHaveBeenCalledWith('quit_app')
  })
  it('reads compiled native capabilities for store builds', async () => {
    mocks.invoke.mockResolvedValue(false)
    expect(await supportsDesktopUpdates()).toBe(false)
    expect(mocks.invoke).toHaveBeenCalledWith('desktop_self_update_enabled')
  })
})
