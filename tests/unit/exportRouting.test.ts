// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

const tauri = vi.hoisted(() => ({
  isMobileApp: vi.fn(() => false),
  isDesktopApp: vi.fn(() => false),
}))
vi.mock('@/desktop/tauri', () => ({
  isMobileApp: tauri.isMobileApp,
  isDesktopApp: tauri.isDesktopApp,
  isTauri: vi.fn(() => false),
}))

vi.mock('@/storage/preparedShare', () => ({
  requestFileShare: vi.fn(async (file: File) => navigator.share({ files: [file] })),
}))

import { canExportFiles, exportBlob, ExportCancelled } from '@/storage/import-export'

type Nav = { canShare?: unknown; share?: unknown }
const nav = () => navigator as unknown as Nav

function setShare(opts: {
  canShare?: (d: unknown) => boolean
  share?: (data: { files?: File[] }) => Promise<unknown>
}) {
  if (opts.canShare) nav().canShare = opts.canShare
  else delete nav().canShare
  if (opts.share) nav().share = opts.share
  else delete nav().share
}

describe('canExportFiles', () => {
  beforeEach(() => tauri.isMobileApp.mockReturnValue(false))
  afterEach(() => {
    vi.clearAllMocks()
    setShare({})
  })

  it('is true off mobile, where <a download> works', () => {
    expect(canExportFiles()).toBe(true)
  })

  it('is true on the phone app when the share sheet exists', () => {
    tauri.isMobileApp.mockReturnValue(true)
    setShare({ canShare: () => true, share: async () => undefined })
    expect(canExportFiles()).toBe(true)
  })

  it('is false on the phone app with no share sheet, so callers hide the control', () => {
    // Regression: exports used <a download>, which wry cancels inside a Tauri
    // WKWebView because no download handler is registered. Every export was a
    // visible control that silently did nothing — App Store Guideline 2.1.
    tauri.isMobileApp.mockReturnValue(true)
    setShare({})
    expect(canExportFiles()).toBe(false)
  })
})

describe('exportBlob', () => {
  beforeEach(() => {
    tauri.isMobileApp.mockReturnValue(true)
    tauri.isDesktopApp.mockReturnValue(false)
  })
  afterEach(() => {
    vi.clearAllMocks()
    setShare({})
  })

  it('hands the file to the share sheet on the phone app', async () => {
    const share = vi.fn(async (_data: { files?: File[] }) => undefined)
    setShare({ canShare: () => true, share })
    await exportBlob(new Blob(['hi'], { type: 'text/plain' }), 'note.md')
    expect(share).toHaveBeenCalledTimes(1)
    expect(share.mock.calls[0][0].files?.[0].name).toBe('note.md')
  })

  it('reports rather than silently no-opping when sharing is unavailable', async () => {
    setShare({ canShare: () => false })
    await expect(exportBlob(new Blob(['hi']), 'note.md')).rejects.toThrow(/cannot share files/)
  })

  it('uses the native save panel on the desktop app, not <a download>', async () => {
    // The desktop webview cancels <a download> for the same reason the phone
    // does, so exports were silently no-opping on macOS too.
    tauri.isMobileApp.mockReturnValue(false)
    tauri.isDesktopApp.mockReturnValue(true)
    // Watch the first thing downloadBlob does. Asserting on anchor.click() is
    // useless here: jsdom has no URL.createObjectURL, so downloadBlob throws
    // before it ever clicks, and the assertion passes either way.
    const createObjectURL = vi.fn(() => 'blob:stub')
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })

    // The Tauri plugin has no IPC host outside the shell, so the native branch
    // rejects; that rejection is itself proof it ran.
    await exportBlob(new Blob(['hi']), 'note.md').catch(() => undefined)
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  it('treats a dismissed share sheet as a cancel, not an error', async () => {
    tauri.isMobileApp.mockReturnValue(true)
    setShare({
      canShare: () => true,
      share: async () => {
        throw new DOMException('cancelled', 'AbortError')
      },
    })
    await expect(exportBlob(new Blob(['hi']), 'note.md')).rejects.toBeInstanceOf(ExportCancelled)
  })
})
