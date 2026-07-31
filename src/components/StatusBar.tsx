// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Status bar: save state, word count, indexing progress and the
 * network-status indicator (Local / Offline / Update available). Offline is
 * a normal, supported state — never presented as an error.
 */
import { useEffect, useState } from 'react'
import { Check, Loader2, CircleAlert, PanelRightOpen } from 'lucide-react'
import { useVault } from '@/app/vaultStore'
import { useUi } from '@/app/uiStore'
import { useActiveNotePath } from './panels/BacklinksPanel'
import { usePwa } from '@/app/usePwa'

export function StatusBar() {
  const path = useActiveNotePath()
  const note = useVault((s) => (path ? s.notes.get(path) : undefined))
  const meta = useVault((s) => (path ? s.metas.get(path) : undefined))
  const indexProgress = useVault((s) => s.indexProgress)
  const vault = useVault((s) => s.vault)
  const ui = useUi()
  const { updateAvailable, applyUpdate } = usePwa()
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  return (
    <footer className="status-bar" aria-label="Status bar">
      {vault && (
        <span className="status-item" title={`Vault: ${vault.name} (${vault.kind})`}>
          {vault.kind === 'browser' ? 'Browser vault' : 'Local folder'}
        </span>
      )}
      {note && (
        <span className="status-item" role="status" aria-live="polite">
          {note.saveState === 'saved' && (
            <>
              <Check size={12} aria-hidden /> Saved
            </>
          )}
          {note.saveState === 'unsaved' && <>Editing…</>}
          {note.saveState === 'saving' && (
            <>
              <Loader2 size={12} aria-hidden /> Saving…
            </>
          )}
          {note.saveState === 'error' && (
            <>
              <CircleAlert size={12} aria-hidden /> Save failed
            </>
          )}
        </span>
      )}
      {meta && (
        <span className="status-item">
          {meta.wordCount.toLocaleString()} words · {meta.charCount.toLocaleString()} characters
        </span>
      )}
      {indexProgress && indexProgress.total > 0 && indexProgress.done < indexProgress.total && (
        <span className="status-item" role="status">
          Indexing {indexProgress.done}/{indexProgress.total}…
        </span>
      )}
      <span className="status-spacer" />
      {updateAvailable ? (
        <button
          className="network-badge update"
          onClick={() => void applyUpdate()}
          title="A new version of Neoma is ready. Click to reload."
        >
          <span className="dot" aria-hidden />
          Update available
        </button>
      ) : (
        <span
          className={`network-badge${online ? '' : ' offline'}`}
          title={
            online
              ? 'neoma runs locally. Being online is never required.'
              : 'Offline — everything keeps working. Notes are stored on this device.'
          }
        >
          <span className="dot" aria-hidden />
          {online ? 'Local' : 'Offline'}
        </span>
      )}
      <button
        className="icon-btn"
        onClick={ui.toggleRightSidebar}
        aria-label="Toggle context sidebar"
        title="Toggle context sidebar"
      >
        <PanelRightOpen size={14} aria-hidden />
      </button>
    </footer>
  )
}
