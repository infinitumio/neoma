// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { requestFileShare, usePreparedShare } from '@/storage/preparedShare'
import { PreparedShareDialog } from '@/components/PreparedShareDialog'

afterEach(() => {
  cleanup()
  usePreparedShare.setState({ pending: null })
  vi.restoreAllMocks()
})

describe('prepared iOS export', () => {
  it('waits for a fresh tap and keeps a cancelled system share available to retry', async () => {
    const share = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('Cancelled', 'AbortError'))
      .mockResolvedValueOnce(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    const file = new File(['backup'], 'notes.zip')
    const result = requestFileShare(file)
    render(<PreparedShareDialog />)
    expect(share).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Share or save'))
    await waitFor(() =>
      expect(screen.getByText('Share or save').hasAttribute('disabled')).toBe(false),
    )
    expect(usePreparedShare.getState().pending?.file).toBe(file)
    fireEvent.click(screen.getByText('Share or save'))
    await result
    expect(share).toHaveBeenCalledTimes(2)
    expect(share).toHaveBeenLastCalledWith({ files: [file], title: 'notes.zip' })
    expect(usePreparedShare.getState().pending).toBeNull()
  })
  it('rejects explicitly when the prepared export is cancelled', async () => {
    const result = requestFileShare(new File(['backup'], 'notes.zip'))
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' })
    render(<PreparedShareDialog />)
    fireEvent.click(screen.getByText('Cancel'))
    await rejected
  })
})
