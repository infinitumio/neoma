// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Insert-attachment picker for the current page. Either choose an existing
 * file from the vault, or add a new one — added files are imported *under*
 * the page (it becomes their parent in the tree). The chosen file is inserted
 * into the editor as an embed (images/PDFs) or a link.
 */
import { useMemo, useRef, useState } from 'react'
import { Paperclip, Upload, FileText, Image as ImageIcon, FileType2 } from 'lucide-react'
import { Modal } from './Modal'
import { useUi } from '@/app/uiStore'
import { useVault, listAttachments, attachToPage, refreshEntries } from '@/app/vaultStore'
import { basename, isImage, isPdf } from '@/utils/paths'

function embedFor(path: string): string {
  // Images and PDFs embed; other files link.
  if (isImage(path) || isPdf(path)) return `![[${path}]]`
  return `[[${path}]]`
}

export function AttachmentPicker() {
  const notePath = useUi((s) => s.attachmentPickerFor)
  const close = () => useUi.getState().setAttachmentPickerFor(null)
  const ui = useUi()
  useVault((s) => s.entries)
  const [tab, setTab] = useState<'vault' | 'add'>('vault')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const attachments = useMemo(() => {
    const q = query.toLowerCase().trim()
    return listAttachments().filter((a) => !q || a.path.toLowerCase().includes(q))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, useVault((s) => s.entries)])

  if (!notePath) return null

  const insert = (path: string) => {
    window.dispatchEvent(new CustomEvent('neoma:insert-text', { detail: { text: embedFor(path) } }))
    ui.toast('Attachment inserted', 'success')
    close()
  }

  const onAdd = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      let lastPath: string | null = null
      for (const file of files) {
        lastPath = await attachToPage(notePath, file, file.name)
      }
      await refreshEntries()
      if (lastPath) {
        insert(lastPath)
        ui.toast('File attached under this page', 'success')
      }
    } catch (err) {
      ui.toast(err instanceof Error ? err.message : 'Could not attach file', 'error')
    } finally {
      setBusy(false)
    }
  }

  const icon = (path: string) =>
    isImage(path) ? (
      <ImageIcon size={15} aria-hidden />
    ) : isPdf(path) ? (
      <FileType2 size={15} aria-hidden />
    ) : (
      <FileText size={15} aria-hidden />
    )

  return (
    <Modal title="Insert attachment" onClose={close}>
      <div className="help-tabs" style={{ marginBottom: 'var(--space-3)' }}>
        <button
          className={`mode-chip${tab === 'vault' ? ' active' : ''}`}
          onClick={() => setTab('vault')}
        >
          <Paperclip size={13} aria-hidden /> From vault
        </button>
        <button
          className={`mode-chip${tab === 'add' ? ' active' : ''}`}
          onClick={() => setTab('add')}
        >
          <Upload size={13} aria-hidden /> Add a file
        </button>
      </div>

      {tab === 'vault' ? (
        <div>
          <input
            className="input"
            type="search"
            placeholder="Find a file…"
            aria-label="Find attachment"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ marginBottom: 'var(--space-2)' }}
          />
          <div className="attachment-list">
            {attachments.length === 0 && (
              <p className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
                No files in the vault yet. Use “Add a file” to bring one in.
              </p>
            )}
            {attachments.map((a) => (
              <button key={a.path} className="attachment-row" onClick={() => insert(a.path)}>
                {icon(a.path)}
                <span className="attachment-name">{basename(a.path)}</span>
                <span className="text-faint text-small">{a.path}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="attachment-add">
          <p className="text-secondary text-small" style={{ marginBottom: 'var(--space-3)' }}>
            The file is imported into your vault under this page — the page becomes its parent in
            the sidebar — and inserted here. Nothing is uploaded anywhere.
          </p>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={15} aria-hidden /> {busy ? 'Attaching…' : 'Choose a file…'}
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="visually-hidden"
            tabIndex={-1}
            onChange={(e) => {
              void onAdd(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      )}
    </Modal>
  )
}
