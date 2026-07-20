// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Global dialogs: confirm, prompt, external-change conflict resolution,
 * rename link-update review, and the keyboard shortcuts reference.
 */
import { useState } from 'react'
import { Modal } from './Modal'
import { useUi } from '@/app/uiStore'
import {
  useVault,
  resolveConflict,
  applyLinkUpdates,
  dismissLinkUpdatePlan,
  requestFolderAccess,
} from '@/app/vaultStore'
import { listCommands } from '@/commands/registry'
import { effectiveBinding } from '@/commands/shortcuts'
import { formatShortcut } from '@/utils/misc'

function ConfirmDialog() {
  const confirm = useUi((s) => s.confirm)
  const clear = useUi((s) => s.clearDialogs)
  if (!confirm) return null
  return (
    <Modal
      title={confirm.title}
      onClose={clear}
      footer={
        <>
          <button className="btn" onClick={clear}>
            Cancel
          </button>
          <button
            className={`btn ${confirm.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => {
              clear()
              void confirm.onConfirm()
            }}
          >
            {confirm.confirmLabel ?? 'Confirm'}
          </button>
        </>
      }
    >
      <p>{confirm.message}</p>
    </Modal>
  )
}

function PromptDialog() {
  const prompt = useUi((s) => s.prompt)
  const clear = useUi((s) => s.clearDialogs)
  const [value, setValue] = useState('')
  const [mountedFor, setMountedFor] = useState<object | null>(null)
  if (!prompt) {
    if (mountedFor) setMountedFor(null)
    return null
  }
  if (mountedFor !== prompt) {
    setMountedFor(prompt)
    setValue(prompt.initial ?? '')
    return null
  }
  const submit = () => {
    clear()
    void prompt.onSubmit(value)
  }
  return (
    <Modal
      title={prompt.title}
      onClose={clear}
      footer={
        <>
          <button className="btn" onClick={clear}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit}>
            {prompt.confirmLabel ?? 'OK'}
          </button>
        </>
      }
    >
      <div className="form-row">
        <label htmlFor="prompt-input">{prompt.label}</label>
        <input
          id="prompt-input"
          className="input"
          value={value}
          placeholder={prompt.placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
        />
      </div>
    </Modal>
  )
}

function ConflictDialog() {
  const conflict = useVault((s) => s.conflict)
  if (!conflict) return null
  return (
    <Modal
      title="File changed outside neoma"
      onClose={() => void resolveConflict('keep-mine')}
      wide
      footer={
        <>
          <button className="btn" onClick={() => void resolveConflict('use-disk')}>
            Use the version on disk
          </button>
          <button className="btn btn-primary" onClick={() => void resolveConflict('keep-mine')}>
            Keep my version
          </button>
        </>
      }
    >
      <p>
        <strong>{conflict.path}</strong> was modified by another program while you were editing it.
        Choose which version to keep — nothing has been overwritten yet.
      </p>
      <div className="form-row" style={{ marginTop: 'var(--space-3)' }}>
        <label>Version on disk (excerpt)</label>
        <pre
          style={{
            maxHeight: '10rem',
            overflow: 'auto',
            background: 'var(--color-bg-input)',
            padding: 'var(--space-2)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-xs)',
          }}
        >
          {conflict.diskContent.slice(0, 2000)}
        </pre>
      </div>
    </Modal>
  )
}

function LinkUpdateDialog() {
  const plan = useVault((s) => s.linkUpdatePlan)
  const toast = useUi((s) => s.toast)
  if (!plan) return null
  const total = plan.affected.reduce((sum, a) => sum + a.count, 0)
  return (
    <Modal
      title="Update links to the renamed note?"
      onClose={dismissLinkUpdatePlan}
      footer={
        <>
          <button className="btn" onClick={dismissLinkUpdatePlan}>
            Leave links unchanged
          </button>
          <button
            className="btn btn-primary"
            onClick={() =>
              void applyLinkUpdates(plan).then((count) =>
                toast(`Updated ${count} link${count === 1 ? '' : 's'}`, 'success'),
              )
            }
          >
            Update {total} link{total === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      <p>
        The note was renamed to <strong>{plan.newName}</strong>. {plan.affected.length} note
        {plan.affected.length === 1 ? '' : 's'} still link to the old name. neoma can rewrite those
        links — only the link targets change, nothing else in your notes.
      </p>
      <ul style={{ marginTop: 'var(--space-3)', paddingLeft: '1.2rem' }}>
        {plan.affected.map((entry) => (
          <li key={entry.path} className="text-small">
            <strong>{entry.title}</strong>{' '}
            <span className="text-secondary">
              ({entry.count} link{entry.count === 1 ? '' : 's'}) — {entry.path}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

function PermissionDialog() {
  const status = useVault((s) => s.status)
  const vault = useVault((s) => s.vault)
  const toast = useUi((s) => s.toast)
  if (status !== 'permission' || !vault) return null
  return (
    <Modal
      title="Folder access needed"
      onClose={() => {}}
      initialFocus
      footer={
        <button
          className="btn btn-primary"
          onClick={() =>
            void requestFolderAccess().then((granted) => {
              if (!granted) toast('Access was not granted. You can retry any time.', 'warning')
            })
          }
        >
          Grant access to “{vault.name}”
        </button>
      }
    >
      <p>
        Your browser revoked permission for the vault folder (this is normal after a restart). Click
        below to re-grant read/write access. Your notes are untouched.
      </p>
    </Modal>
  )
}

function ShortcutsHelp() {
  const open = useUi((s) => s.shortcutsHelpOpen)
  const setOpen = useUi((s) => s.setShortcutsHelpOpen)
  if (!open) return null
  const bound = listCommands()
    .map((c) => ({ ...c, binding: effectiveBinding(c.id, c.shortcut) }))
    .filter((c) => c.binding)
  return (
    <Modal title="Keyboard shortcuts" onClose={() => setOpen(false)}>
      <table className="props-table">
        <tbody>
          {bound.map((c) => (
            <tr key={c.id}>
              <th scope="row">{c.title}</th>
              <td>
                <span className="kbd">{formatShortcut(c.binding!)}</span>
              </td>
            </tr>
          ))}
          <tr>
            <th scope="row">Bold / Italic / Code</th>
            <td>
              <span className="kbd">{formatShortcut('Mod+B')}</span>{' '}
              <span className="kbd">{formatShortcut('Mod+I')}</span>{' '}
              <span className="kbd">{formatShortcut('Mod+E')}</span>
            </td>
          </tr>
          <tr>
            <th scope="row">Insert wiki link</th>
            <td>
              <span className="kbd">{formatShortcut('Mod+Shift+K')}</span>
            </td>
          </tr>
          <tr>
            <th scope="row">Save now</th>
            <td>
              <span className="kbd">{formatShortcut('Mod+S')}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="text-small text-faint" style={{ marginTop: 'var(--space-3)' }}>
        Bindings can be customised in Settings → Keyboard shortcuts.
      </p>
    </Modal>
  )
}

export function Dialogs() {
  return (
    <>
      <ConfirmDialog />
      <PromptDialog />
      <ConflictDialog />
      <LinkUpdateDialog />
      <PermissionDialog />
      <ShortcutsHelp />
    </>
  )
}
