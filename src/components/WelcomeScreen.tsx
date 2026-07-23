// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Welcome flow: create a browser vault, open a local folder, import a vault,
 * explore the demo, or learn how storage works. Deliberately short — no
 * multi-step onboarding.
 */
import { useEffect, useRef, useState } from 'react'
import { Database, FolderOpen, Upload, Compass, HelpCircle, ChevronRight } from 'lucide-react'
import type { Vault } from '@/types'
import {
  listVaults,
  createBrowserVault,
  openLocalFolderVault,
  openTauriFolderVault,
  removeVault,
} from '@/storage/VaultManager'
import { supportsLocalFolders } from '@/storage/local-folder/LocalFolderAdapter'
import { isTauri, isMobileApp } from '@/desktop/tauri'
import { openVault, getAdapter, refreshEntries } from '@/app/vaultStore'
import { importFiles } from '@/storage/import-export'
import { demoNotes } from '@/templates/demoVault'
import { useUi } from '@/app/uiStore'
import { useTabs } from '@/app/tabsStore'
import { Modal } from './Modal'
import { NewVaultDialog } from './NewVaultDialog'
import { APP_NAME, APP_TAGLINE } from '@/app/about'
import { friendlyDateTime } from '@/utils/dates'

export function WelcomeScreen() {
  const [vaults, setVaults] = useState<Vault[]>([])
  const [showStorageHelp, setShowStorageHelp] = useState(false)
  const [busy, setBusy] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
  const ui = useUi()
  const desktop = isTauri()
  // On the phone app, keep the welcome actions terse (short titles, no long
  // descriptions) so everything fits comfortably on a small screen.
  const mobile = isMobileApp()
  // Chromium browsers use the File System Access API; the desktop app uses
  // Tauri's native filesystem, so folder vaults work there too.
  const localFoldersSupported = supportsLocalFolders() || desktop

  useEffect(() => {
    void listVaults().then(setVaults)
  }, [])

  const [showNewVault, setShowNewVault] = useState(false)

  const openFolder = async () => {
    try {
      setBusy(true)
      const vault = desktop ? await openTauriFolderVault() : await openLocalFolderVault()
      if (vault) await openVault(vault)
    } catch (err) {
      ui.toast(err instanceof Error ? err.message : 'Could not open folder', 'error')
    } finally {
      setBusy(false)
    }
  }

  const exploreDemo = async () => {
    setBusy(true)
    try {
      const existing = vaults.find((v) => v.name === 'Neoma demo' && v.kind === 'browser')
      if (existing) {
        await openVault(existing)
        return
      }
      const vault = await createBrowserVault('Neoma demo')
      await openVault(vault)
      const adapter = getAdapter()
      if (!adapter) return
      for (const note of demoNotes()) {
        await adapter.writeText(note.path, note.content)
      }
      await refreshEntries()
      useTabs.getState().openNote('Welcome to Neoma.md')
    } finally {
      setBusy(false)
    }
  }

  const importVault = () => importInput.current?.click()

  const onImportFiles = async (files: FileList | null) => {
    if (!files?.length) return
    ui.askPrompt({
      title: 'Import into a new browser vault',
      label: 'Vault name',
      initial: files[0].name.replace(/\.zip$/i, ''),
      confirmLabel: 'Import',
      onSubmit: async (name) => {
        setBusy(true)
        try {
          const vault = await createBrowserVault(name)
          await openVault(vault)
          const adapter = getAdapter()
          if (!adapter) return
          const summary = await importFiles(adapter, [...files])
          await refreshEntries()
          ui.toast(
            `Imported ${summary.notes} notes and ${summary.attachments} attachments`,
            'success',
          )
        } finally {
          setBusy(false)
        }
      },
    })
  }

  const forget = (vault: Vault) => {
    ui.askConfirm({
      title: vault.kind === 'browser' ? 'Delete vault?' : 'Forget folder?',
      message:
        vault.kind === 'browser'
          ? `"${vault.name}" and all its notes will be permanently deleted from this browser. Export it first if you need a copy.`
          : `Neoma will forget "${vault.name}". The folder and its files on disk are not touched.`,
      confirmLabel: vault.kind === 'browser' ? 'Delete vault' : 'Forget',
      danger: vault.kind === 'browser',
      onConfirm: async () => {
        await removeVault(vault)
        setVaults(await listVaults())
      },
    })
  }

  return (
    <main className="welcome">
      <div className="welcome-card">
        <div className="welcome-logo">
          <img src="/favicon.svg" alt="" aria-hidden />
          <div>
            <h1>{APP_NAME}</h1>
          </div>
        </div>
        <p className="welcome-tagline">{APP_TAGLINE}</p>

        <div className="welcome-actions">
          <button className="welcome-action" onClick={() => setShowNewVault(true)} disabled={busy}>
            <Database className="action-icon" size={20} aria-hidden />
            <span className="action-text">
              <span className="action-title">{mobile ? 'New vault' : 'Create my first vault'}</span>
              {!mobile && (
                <span className="action-desc">
                  A private home for your pages, stored on this device. Pick a starter for study,
                  research or personal notes.
                </span>
              )}
            </span>
            <ChevronRight size={16} aria-hidden />
          </button>

          {/* Native folder vaults need the sandboxed document picker on iOS,
              which isn't wired up yet — offer Import there instead. */}
          {!mobile && (
            <button
              className="welcome-action"
              onClick={() => void openFolder()}
              disabled={busy || !localFoldersSupported}
              title={
                localFoldersSupported
                  ? undefined
                  : 'Not supported by this browser — use a Chromium-based browser, or the desktop app'
              }
            >
              <FolderOpen className="action-icon" size={20} aria-hidden />
              <span className="action-text">
                <span className="action-title">Open local folder</span>
                <span className="action-desc">
                  {localFoldersSupported
                    ? 'Plain .md files in a folder you choose — great with Git.'
                    : 'Unavailable in this browser (needs the File System Access API, or use the desktop app).'}
                </span>
              </span>
              <ChevronRight size={16} aria-hidden />
            </button>
          )}

          <button className="welcome-action" onClick={importVault} disabled={busy}>
            <Upload className="action-icon" size={20} aria-hidden />
            <span className="action-text">
              <span className="action-title">{mobile ? 'Import' : 'Import vault'}</span>
              {!mobile && (
                <span className="action-desc">From a ZIP export or individual Markdown files.</span>
              )}
            </span>
            <ChevronRight size={16} aria-hidden />
          </button>

          <button className="welcome-action" onClick={() => void exploreDemo()} disabled={busy}>
            <Compass className="action-icon" size={20} aria-hidden />
            <span className="action-text">
              <span className="action-title">{mobile ? 'Demo vault' : 'Explore demo vault'}</span>
              {!mobile && (
                <span className="action-desc">
                  A small research vault showing links, templates and search.
                </span>
              )}
            </span>
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>

        <p className="welcome-privacy">
          {!mobile && 'No account is required. Your notes remain on this device. '}
          <button
            className="text-secondary"
            style={{ textDecoration: 'underline' }}
            onClick={() => setShowStorageHelp(true)}
          >
            <HelpCircle size={12} aria-hidden style={{ verticalAlign: '-2px' }} />{' '}
            {mobile ? 'How storage works' : 'Learn how storage works'}
          </button>
        </p>

        {vaults.length > 0 && (
          <div className="recent-vaults">
            <div className="sidebar-section-label">Recent vaults</div>
            {vaults.map((vault) => (
              <div key={vault.id} style={{ display: 'flex', gap: 'var(--space-1)' }}>
                <button
                  className="tree-item"
                  style={{ flex: 1 }}
                  onClick={() => void openVault(vault)}
                >
                  {vault.kind === 'browser' ? (
                    <Database size={14} aria-hidden />
                  ) : (
                    <FolderOpen size={14} aria-hidden />
                  )}
                  <span className="tree-label">{vault.name}</span>
                  <span className="text-faint text-small">
                    {friendlyDateTime(vault.lastOpenedAt)}
                  </span>
                </button>
                <button
                  className="icon-btn"
                  aria-label={`Remove ${vault.name} from this list`}
                  onClick={() => forget(vault)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        ref={importInput}
        type="file"
        multiple
        accept=".md,.zip"
        className="visually-hidden"
        tabIndex={-1}
        onChange={(e) => {
          void onImportFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {showNewVault && <NewVaultDialog onClose={() => setShowNewVault(false)} />}

      {showStorageHelp && (
        <Modal title="How Neoma stores your notes" onClose={() => setShowStorageHelp(false)}>
          <div className="text-small" style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <p>
              <strong>Browser vault.</strong> Notes are saved in this browser's local database
              (IndexedDB). They never leave your device. Clearing this site's browsing data deletes
              browser vaults, so export a ZIP backup from time to time.
            </p>
            <p>
              <strong>Local folder vault.</strong> Notes are ordinary <code>.md</code> files in a
              folder you pick. Neoma asks the browser for permission after you choose the folder,
              and never uploads anything. Works in Chromium-based browsers (Chrome, Edge, Brave,
              Arc).
            </p>
            <p>
              <strong>Portability.</strong> Either way, your notes are plain Markdown with YAML
              frontmatter — readable in VS Code, Obsidian, Logseq and any text editor. Import and
              export are always available.
            </p>
          </div>
        </Modal>
      )}
    </main>
  )
}
