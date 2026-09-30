// SPDX-License-Identifier: AGPL-3.0-or-later
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  supported: vi.fn(),
  flush: vi.fn(),
  check: vi.fn(),
  download: vi.fn(),
  relaunch: vi.fn(),
}))
vi.mock('@/desktop/capabilities', () => ({ supportsDesktopUpdates: mocks.supported }))
vi.mock('@/app/vaultStore', () => ({ flushAllSaves: mocks.flush }))
vi.mock('@tauri-apps/plugin-updater', () => ({ check: mocks.check }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: mocks.relaunch }))
import { checkForDesktopUpdate } from '@/desktop/updater'
beforeEach(() => {
  vi.clearAllMocks()
  mocks.supported.mockResolvedValue(true)
  mocks.flush.mockResolvedValue(undefined)
  mocks.download.mockResolvedValue(undefined)
  mocks.check.mockResolvedValue({
    version: '1.0.5',
    currentVersion: '1.0.4',
    downloadAndInstall: mocks.download,
  })
})
it('never calls the updater for a store build', async () => {
  mocks.supported.mockResolvedValue(false)
  expect(await checkForDesktopUpdate()).toBeNull()
  expect(mocks.check).not.toHaveBeenCalled()
})
it('saves before installation and again before restarting', async () => {
  const order: string[] = []
  mocks.flush.mockImplementation(async () => {
    order.push('save')
  })
  mocks.download.mockImplementation(async () => {
    order.push('install')
  })
  mocks.relaunch.mockImplementation(async () => {
    order.push('restart')
  })
  await (await checkForDesktopUpdate())!.install()
  expect(order).toEqual(['save', 'install', 'save', 'restart'])
})
it('does not restart if saving edits made during the download fails', async () => {
  mocks.flush.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Disk full'))
  await expect((await checkForDesktopUpdate())!.install()).rejects.toThrow('Disk full')
  expect(mocks.download).toHaveBeenCalledTimes(1)
  expect(mocks.relaunch).not.toHaveBeenCalled()
})
