// SPDX-License-Identifier: AGPL-3.0-or-later
import { useState } from 'react'
import { usePreparedShare } from '@/storage/preparedShare'
import { Modal } from './Modal'

export function PreparedShareDialog() {
  const pending = usePreparedShare((state) => state.pending)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!pending) return null
  const close = () => {
    if (busy) return
    usePreparedShare.setState({ pending: null })
    setError('')
    pending.reject(new DOMException('Export cancelled', 'AbortError'))
  }
  const share = async () => {
    setBusy(true)
    setError('')
    try {
      // Invoke before any await: the button tap supplies transient user activation.
      await navigator.share({ files: [pending.file], title: pending.file.name })
      usePreparedShare.setState({ pending: null })
      pending.resolve()
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Could not share this file. Try again.')
      }
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title="Export ready"
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => void share()} disabled={busy}>
            {busy ? 'Sharing…' : 'Share or save'}
          </button>
        </>
      }
    >
      <p>{pending.file.name}</p>
      <p className="text-secondary">
        Choose Share or save, then Save to Files to keep a backup on your device.
      </p>
      {error && <p role="alert">{error}</p>}
    </Modal>
  )
}
