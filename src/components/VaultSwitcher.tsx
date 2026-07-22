// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Vault switcher: see every vault you have and jump between them without
 * losing your place. Opened from the vault name in the sidebar, the command
 * palette, or `Mod+Shift+O`.
 */
import { useEffect, useState } from 'react'
import { Database, FolderOpen, Check, Plus, Home } from 'lucide-react'
import type { Vault } from '@/types'
import { Modal } from './Modal'
import { listVaults, openLocalFolderVault } from '@/storage/VaultManager'
import { openVault, closeVault, useVault, flushAllSaves } from '@/app/vaultStore'
import { useUi } from '@/app/uiStore'
import { friendlyDateTime } from '@/utils/dates'

export function VaultSwitcher() {
  const open = useUi((s) => s.vaultSwitcherOpen)
  const setOpen = useUi((s) => s.setVaultSwitcherOpen)
  const current = useVault((s) => s.vault)
  const [vaults, setVaults] = useState<Vault[]>([])
  const ui = useUi()

  useEffect(() => {
    if (open) void listVaults().then(setVaults)
  }, [open])

  if (!open) return null

  const switchTo = async (vault: Vault) => {
    if (vault.id === current?.id) {
      setOpen(false)
      return
    }
    flushAllSaves()
    setOpen(false)
    await openVault(vault)
  }

  const openFolder = async () => {
    try {
      const vault = await openLocalFolderVault()
      if (vault) {
        setOpen(false)
        await openVault(vault)
      }
    } catch (err) {
      ui.toast(err instanceof Error ? err.message : 'Could not open folder', 'error')
    }
  }

  return (
    <Modal title="Your vaults" onClose={() => setOpen(false)}>
      <p className="text-secondary text-small" style={{ marginBottom: 'var(--space-3)' }}>
        A vault is a self-contained collection of pages. Switch between them here — your open tabs
        are remembered for each vault.
      </p>

      <div className="vault-list">
        {vaults.map((vault) => (
          <button key={vault.id} className="vault-row" onClick={() => void switchTo(vault)}>
            {vault.kind === 'browser' ? (
              <Database size={16} className="vault-row-icon" aria-hidden />
            ) : (
              <FolderOpen size={16} className="vault-row-icon" aria-hidden />
            )}
            <span className="vault-row-text">
              <span className="vault-row-name">{vault.name}</span>
              <span className="vault-row-meta">
                {vault.kind === 'browser' ? 'Browser vault' : 'Local folder'} · opened{' '}
                {friendlyDateTime(vault.lastOpenedAt)}
              </span>
            </span>
            {vault.id === current?.id && (
              <span className="vault-row-current" aria-label="Current vault">
                <Check size={15} aria-hidden /> Current
              </span>
            )}
          </button>
        ))}
        {vaults.length === 0 && (
          <p className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
            No vaults yet.
          </p>
        )}
      </div>

      <div className="vault-switcher-actions">
        <button
          className="btn"
          onClick={() => {
            setOpen(false)
            closeVault()
          }}
        >
          <Home size={14} aria-hidden /> Back to welcome
        </button>
        <button className="btn" onClick={() => void openFolder()}>
          <FolderOpen size={14} aria-hidden /> Open a folder
        </button>
        <button
          className="btn btn-primary"
          onClick={() => {
            setOpen(false)
            closeVault()
          }}
          title="Create a new vault from the welcome screen"
        >
          <Plus size={14} aria-hidden /> New vault
        </button>
      </div>
    </Modal>
  )
}
