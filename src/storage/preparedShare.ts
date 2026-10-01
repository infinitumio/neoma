// SPDX-License-Identifier: AGPL-3.0-or-later
import { create } from 'zustand'

type PendingShare = { file: File; resolve: () => void; reject: (error: unknown) => void }
export const usePreparedShare = create<{ pending: PendingShare | null }>(() => ({ pending: null }))

/** File preparation may outlive iOS user activation. Request a fresh, explicit tap. */
export function requestFileShare(file: File): Promise<void> {
  if (usePreparedShare.getState().pending)
    return Promise.reject(new Error('Finish the current export first'))
  return new Promise((resolve, reject) =>
    usePreparedShare.setState({ pending: { file, resolve, reject } }),
  )
}
