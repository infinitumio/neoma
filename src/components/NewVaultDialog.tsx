// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * First-vault onboarding. Explains what a vault is in plain language, then
 * lets the user name it and pick a starter (or blank). Seeds real, editable
 * Markdown pages so the vault opens with something to explore.
 */
import { useState } from 'react'
import { GraduationCap, FlaskConical, BookOpen, FileText, Sparkles } from 'lucide-react'
import { Modal } from './Modal'
import { STARTERS, getStarter, type StarterId } from '@/templates/starterVaults'
import { createBrowserVault } from '@/storage/VaultManager'
import { openVault, getAdapter, refreshEntries } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { useUi } from '@/app/uiStore'

const ICONS: Record<StarterId, typeof FileText> = {
  demo: Sparkles,
  university: GraduationCap,
  research: FlaskConical,
  personal: BookOpen,
  blank: FileText,
}

interface NewVaultDialogProps {
  onClose: () => void
}

export function NewVaultDialog({ onClose }: NewVaultDialogProps) {
  const [name, setName] = useState('My vault')
  const [starter, setStarter] = useState<StarterId>('university')
  const [busy, setBusy] = useState(false)
  const ui = useUi()

  const create = async () => {
    setBusy(true)
    try {
      const vault = await createBrowserVault(name)
      await openVault(vault)
      const adapter = getAdapter()
      if (adapter) {
        for (const file of getStarter(starter).files()) {
          await adapter.writeText(file.path, file.content)
        }
        await refreshEntries()
        const first = getStarter(starter).files()[0]
        if (first) useTabs.getState().openNote(first.path)
      }
      ui.toast('Vault created', 'success')
      onClose()
    } catch (err) {
      ui.toast(err instanceof Error ? err.message : 'Could not create vault', 'error')
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Create your vault"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void create()}
            disabled={busy || !name.trim()}
          >
            {busy ? 'Creating…' : 'Create vault'}
          </button>
        </>
      }
    >
      <p className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
        A <strong>vault</strong> is the folder where Neoma keeps a collection of related pages,
        attachments and settings. You might keep separate vaults for your degree, work, research, or
        personal notes. Everything stays on this device.
      </p>

      <div className="form-row">
        <label htmlFor="vault-name">Vault name</label>
        <input
          id="vault-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. University, Research, Personal"
        />
      </div>

      <div className="form-row">
        <label>Start with</label>
        <div className="starter-grid">
          {STARTERS.map((option) => {
            const Icon = ICONS[option.id]
            return (
              <button
                key={option.id}
                type="button"
                className={`starter-card${starter === option.id ? ' selected' : ''}`}
                aria-pressed={starter === option.id}
                onClick={() => setStarter(option.id)}
              >
                <Icon size={18} className="starter-icon" aria-hidden />
                <span className="starter-name">{option.name}</span>
                <span className="starter-desc">{option.description}</span>
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
