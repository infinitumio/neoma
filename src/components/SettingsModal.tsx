import { useDesktopUpdates } from '@/desktop/capabilities'
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Settings dialog. Sections come from a small registry-style list so future
 * plugins can contribute panes. Everything is stored locally.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { Modal } from './Modal'
import { useUi } from '@/app/uiStore'
import { useVault } from '@/app/vaultStore'
import { parseIcs } from '@/calendar/ics'
import { loadIcs, saveIcs, clearIcs } from '@/calendar/icsStore'
import { useSettings, exportSettingsJson, importSettingsJson } from '@/settings/settingsStore'
import { isDesktopApp, isMobileApp, setLaunchOnStartup } from '@/desktop/tauri'
import type { ApplicationSettings } from '@/types'
import { BUILTIN_TEMPLATES } from '@/templates/builtins'
import { listCommands, runCommand } from '@/commands/registry'
import { effectiveBinding } from '@/commands/shortcuts'
import { exportBlob, canExportFiles, ExportCancelled } from '@/storage/import-export'
import {
  APP_NAME,
  APP_TAGLINE,
  APP_VERSION,
  CREATOR,
  WEBSITE_URL,
  PRIVACY_URL,
  TERMS_URL,
  LICENSE_URL,
  PRIVACY_STATEMENT,
} from '@/app/about'
import { useInstallPrompt, usePwa } from '@/app/usePwa'
import { checkForDesktopUpdate, type DesktopUpdate } from '@/desktop/updater'
import { exportVaultBundle, readVaultBundle, type SyncPreview } from '@/sync/deviceSync'

/** Import events from an .ics file (e.g. exported/subscribed from Google or
 *  Outlook) into the calendar. Offline — the user picks a file they already
 *  have; nothing is fetched. */
function IcsImportRow() {
  const vaultId = useVault((s) => s.vault?.id)
  const fileRef = useRef<HTMLInputElement>(null)
  const [count, setCount] = useState(() => loadIcs(vaultId).length)

  const onFile = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    try {
      const parsed = parseIcs(await file.text(), file.name.replace(/\.ics$/i, ''))
      const merged = [...loadIcs(vaultId), ...parsed]
      saveIcs(vaultId, merged)
      setCount(merged.length)
      useUi.getState().toast(`Imported ${parsed.length} events from ${file.name}`, 'success')
    } catch {
      useUi.getState().toast('Could not read that .ics file', 'error')
    }
  }

  return (
    <Row
      name="Import a calendar (.ics)"
      desc="Bring events from an exported/subscribed Google, Outlook or Apple calendar into Neoma. Read-only, stored locally, never fetched from the network."
    >
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <input
          ref={fileRef}
          type="file"
          accept=".ics,text/calendar"
          hidden
          onChange={(e) => void onFile(e.target.files)}
        />
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Import .ics
        </button>
        {count > 0 && (
          <>
            <span className="text-small text-faint">{count} imported</span>
            <button
              className="btn btn-ghost"
              onClick={() => {
                clearIcs(vaultId)
                setCount(0)
              }}
            >
              Clear
            </button>
          </>
        )}
      </div>
    </Row>
  )
}

function Row({ name, desc, children }: { name: string; desc?: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div className="setting-info">
        <div className="setting-name">{name}</div>
        {desc && <div className="setting-desc">{desc}</div>}
      </div>
      <div className="setting-control">{children}</div>
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span className="knob" />
    </button>
  )
}

/** Update the app (and the features within it) when online: the desktop app
 *  self-updates via the signed release feed, the web app reloads to the latest
 *  service worker, and iOS updates through the App Store. */
function UpdatesRow() {
  const desktopUpdates = useDesktopUpdates()
  const { updateAvailable, applyUpdate, checkForUpdate } = usePwa()
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)
  const [pending, setPending] = useState<DesktopUpdate | null>(null)
  const [installing, setInstalling] = useState(false)

  if (isMobileApp() || (isDesktopApp() && desktopUpdates === false)) {
    return (
      <Row name="Updates" desc="This edition updates through the App Store.">
        <span className="text-small text-faint">Managed by the App Store</span>
      </Row>
    )
  }

  if (isDesktopApp() && desktopUpdates === null) return null

  const desktop = isDesktopApp()

  const check = async () => {
    setChecking(true)
    setChecked(false)
    setPending(null)
    try {
      if (desktop) setPending(await checkForDesktopUpdate())
      else await checkForUpdate()
    } catch {
      useUi.getState().toast('Could not check for updates', 'error')
    }
    setChecking(false)
    setChecked(true)
  }

  const install = async () => {
    if (!pending) return
    setInstalling(true)
    try {
      await pending.install()
    } catch {
      setInstalling(false)
      useUi.getState().toast('Update failed to install', 'error')
    }
  }

  if (desktop && pending) {
    return (
      <Row
        name="Update available"
        desc={`Version ${pending.version} is ready (you have ${pending.currentVersion}).`}
      >
        <button className="btn btn-primary" disabled={installing} onClick={() => void install()}>
          {installing ? 'Installing…' : 'Restart & update'}
        </button>
      </Row>
    )
  }
  if (!desktop && updateAvailable) {
    return (
      <Row name="Update available" desc="A new version has been downloaded.">
        <button className="btn btn-primary" onClick={() => void applyUpdate()}>
          Reload to update
        </button>
      </Row>
    )
  }
  return (
    <Row
      name="Check for updates"
      desc={
        desktop
          ? 'Download and install the latest Neoma when you are online.'
          : 'Fetch the latest version when you are online.'
      }
    >
      <button className="btn" disabled={checking} onClick={() => void check()}>
        {checking ? 'Checking…' : checked ? 'Up to date' : 'Check for updates'}
      </button>
    </Row>
  )
}

/** Portable device sync: save the vault to a file and merge one back in,
 *  verifying it is the same vault by its hashed manifest. Non-destructive. */
function DeviceSyncRows() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<SyncPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useUi.getState().toast

  const onExport = async () => {
    try {
      const n = await exportVaultBundle()
      toast(`Saved ${n} note${n === 1 ? '' : 's'} to a vault file`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save the vault', 'error')
    }
  }

  const onPick = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setBusy(true)
    try {
      setPreview(await readVaultBundle(file))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not read that file', 'error')
    }
    setBusy(false)
  }

  const onApply = async () => {
    if (!preview) return
    setBusy(true)
    try {
      const r = await preview.apply()
      toast(
        `Synced: ${r.added} added${r.conflicts ? `, ${r.conflicts} kept as copies` : ''}`,
        'success',
      )
      setPreview(null)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Sync failed', 'error')
    }
    setBusy(false)
  }

  return (
    <>
      <Row
        name="Save vault to device"
        desc="Save a portable vault file (.neomavault) to a USB drive or folder. Take it to another device and sync it back in below."
      >
        <button className="btn" onClick={() => void onExport()}>
          Save vault file
        </button>
      </Row>
      <Row
        name="Sync from a device file"
        desc="Merge a .neomavault file from another device. Its hashed manifest confirms it is your vault; new notes are added and changed notes are kept as a copy (nothing is overwritten)."
      >
        <input
          ref={fileRef}
          type="file"
          accept=".neomavault,application/octet-stream"
          hidden
          onChange={(e) => {
            void onPick(e.target.files)
            e.target.value = ''
          }}
        />
        <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
          Choose file…
        </button>
      </Row>
      {preview && (
        <div className="setting-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {!preview.sameVault && (
            <p className="text-small" style={{ color: 'var(--color-warning, #e0a52b)' }}>
              Heads up: this file is from a different vault ({preview.incomingVaultName}). You can
              still merge it.
            </p>
          )}
          <p className="text-small text-secondary">
            <strong>{preview.added.length}</strong> new · <strong>{preview.changed.length}</strong>{' '}
            changed (kept as copies) · {preview.identical} identical
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <button
              className="btn btn-primary"
              disabled={busy || (preview.added.length === 0 && preview.changed.length === 0)}
              onClick={() => void onApply()}
            >
              {busy ? 'Syncing…' : 'Merge into this vault'}
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => setPreview(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}

const SECTIONS = [
  'Appearance',
  'Editor',
  'Files and links',
  'Daily notes',
  'Templates',
  'Search',
  'Desktop',
  'Backups',
  'Keyboard shortcuts',
  'Privacy',
  'Acknowledgements',
  'About',
] as const

type Section = (typeof SECTIONS)[number]

export function SettingsModal() {
  const open = useUi((s) => s.settingsOpen)
  const setOpen = useUi((s) => s.setSettingsOpen)
  const toast = useUi((s) => s.toast)
  const settings = useSettings((s) => s.settings)
  const desktopUpdates = useDesktopUpdates()
  const update = useSettings((s) => s.update)
  const [section, setSection] = useState<Section>('Appearance')
  const importInput = useRef<HTMLInputElement>(null)
  const { canInstall, promptInstall } = useInstallPrompt()
  const mobile = isMobileApp()
  const compact = useIsMobile()
  const [sectionOpen, setSectionOpen] = useState(false)
  useEffect(() => {
    if (!open) setSectionOpen(false)
  }, [open])
  // Sections that don't apply to the phone app (no hardware keyboard, no
  // desktop window).
  const hidden = new Set<Section>()
  if (mobile) hidden.add('Keyboard shortcuts')
  if (!isDesktopApp()) hidden.add('Desktop')

  if (!open) return null

  const set = <K extends keyof ApplicationSettings>(key: K, value: ApplicationSettings[K]) =>
    update(key, value)

  return (
    <Modal title="Settings" onClose={() => setOpen(false)} wide initialFocus={false}>
      <div className={`settings-layout${compact ? ' settings-compact' : ''}`}>
        {(!compact || !sectionOpen) && (
          <nav className="settings-nav" aria-label="Settings sections">
            {SECTIONS.filter((name) => !hidden.has(name)).map((name) => (
              <button
                key={name}
                aria-current={section === name}
                onClick={() => {
                  setSection(name)
                  setSectionOpen(true)
                }}
              >
                {name}
              </button>
            ))}
          </nav>
        )}
        <div className="settings-content" hidden={compact && !sectionOpen}>
          {compact && (
            <button className="btn settings-back" onClick={() => setSectionOpen(false)}>
              ‹ Settings
            </button>
          )}
          {compact && <h2 className="settings-section-title">{section}</h2>}
          {section === 'Appearance' && (
            <>
              <Row name="Theme" desc="Neoma Dark is the default; both use the same design tokens">
                <select
                  className="input"
                  value={settings.theme}
                  aria-label="Theme"
                  onChange={(e) => set('theme', e.target.value as 'dark' | 'light')}
                >
                  <option value="dark">Neoma Dark</option>
                  <option value="light">Neoma Light</option>
                </select>
              </Row>
              <Row name="Editor font size" desc={`${settings.editorFontSize}px`}>
                <input
                  className="slider"
                  type="range"
                  min={13}
                  max={22}
                  value={settings.editorFontSize}
                  aria-label="Editor font size"
                  onChange={(e) => set('editorFontSize', Number(e.target.value))}
                />
              </Row>
              <Row
                name="Line width"
                desc={`Maximum editor line width: ${settings.editorLineWidth}rem`}
              >
                <input
                  className="slider"
                  type="range"
                  min={32}
                  max={64}
                  value={settings.editorLineWidth}
                  aria-label="Editor line width"
                  onChange={(e) => set('editorLineWidth', Number(e.target.value))}
                />
              </Row>
              <Row name="Reduce motion" desc="Disable interface transitions">
                <select
                  className="input"
                  value={settings.reducedMotion}
                  aria-label="Motion preference"
                  onChange={(e) =>
                    set('reducedMotion', e.target.value as ApplicationSettings['reducedMotion'])
                  }
                >
                  <option value="system">Follow system</option>
                  <option value="reduced">Reduced</option>
                  <option value="full">Full</option>
                </select>
              </Row>
              {!mobile && (
                <Row
                  name="Hover tooltips"
                  desc="Show labels when hovering toolbar and sidebar buttons"
                >
                  <Toggle
                    checked={settings.showTooltips}
                    onChange={(v) => set('showTooltips', v)}
                    label="Hover tooltips"
                  />
                </Row>
              )}
              <Row
                name="Notification close button"
                desc="Show a × on notifications (they auto-dismiss either way)"
              >
                <Toggle
                  checked={settings.showToastIcons}
                  onChange={(v) => set('showToastIcons', v)}
                  label="Notification close button"
                />
              </Row>
              <Row
                name="Load remote content"
                desc="Off by default. A remote image or video embed tells whoever controls that address when you opened the note, and from where. The provider may receive your IP address and apply its own privacy policy."
              >
                <Toggle
                  checked={settings.allowRemoteContent}
                  onChange={(v) => set('allowRemoteContent', v)}
                  label="Load remote content"
                />
              </Row>
            </>
          )}

          {section === 'Editor' && (
            <>
              <Row name="Default view mode" desc="Used when opening notes">
                <select
                  className="input"
                  value={settings.defaultEditorMode}
                  aria-label="Default editor mode"
                  onChange={(e) =>
                    set(
                      'defaultEditorMode',
                      e.target.value as ApplicationSettings['defaultEditorMode'],
                    )
                  }
                >
                  <option value="edit">Edit</option>
                  <option value="split">Split</option>
                  <option value="reading">Reading</option>
                </select>
              </Row>
              <Row name="Line numbers">
                <Toggle
                  checked={settings.showLineNumbers}
                  onChange={(v) => set('showLineNumbers', v)}
                  label="Show line numbers"
                />
              </Row>
              <Row name="Spellcheck" desc="Uses the browser's local spellchecker">
                <Toggle
                  checked={settings.spellcheck}
                  onChange={(v) => set('spellcheck', v)}
                  label="Enable spellcheck"
                />
              </Row>
              <Row name="Breadcrumbs" desc="Show the folder trail above each note">
                <Toggle
                  checked={settings.showBreadcrumbs}
                  onChange={(v) => set('showBreadcrumbs', v)}
                  label="Show breadcrumbs"
                />
              </Row>
              <Row
                name="Source view"
                desc="Add a read-only Markdown source mode to the view switcher"
              >
                <Toggle
                  checked={settings.showSourceView}
                  onChange={(v) => set('showSourceView', v)}
                  label="Show source view"
                />
              </Row>
              <Row
                name="Autosave delay"
                desc={`${settings.autosaveDelayMs} ms after you stop typing`}
              >
                <input
                  className="input"
                  type="number"
                  min={200}
                  max={5000}
                  step={100}
                  value={settings.autosaveDelayMs}
                  aria-label="Autosave delay in milliseconds"
                  onChange={(e) => set('autosaveDelayMs', Number(e.target.value) || 700)}
                />
              </Row>
            </>
          )}

          {section === 'Files and links' && (
            <>
              <Row name="Attachment folder" desc="Pasted images and files are saved here">
                <input
                  className="input"
                  value={settings.attachmentFolder}
                  aria-label="Attachment folder"
                  onChange={(e) => set('attachmentFolder', e.target.value)}
                />
              </Row>
              <Row name="Confirm before delete">
                <Toggle
                  checked={settings.confirmBeforeDelete}
                  onChange={(v) => set('confirmBeforeDelete', v)}
                  label="Confirm before delete"
                />
              </Row>
              <Row name="Default sort order">
                <select
                  className="input"
                  value={settings.fileSortOrder}
                  aria-label="File sort order"
                  onChange={(e) =>
                    set('fileSortOrder', e.target.value as ApplicationSettings['fileSortOrder'])
                  }
                >
                  <option value="name">Name</option>
                  <option value="created">Created date</option>
                  <option value="modified">Modified date</option>
                </select>
              </Row>
            </>
          )}

          {section === 'Daily notes' && (
            <>
              <Row name="Folder" desc="Where daily notes are created">
                <input
                  className="input"
                  value={settings.dailyNotesFolder}
                  aria-label="Daily notes folder"
                  onChange={(e) => set('dailyNotesFolder', e.target.value)}
                />
              </Row>
              <Row name="Date format" desc="Tokens: YYYY, MM, DD (e.g. YYYY-MM-DD)">
                <input
                  className="input"
                  value={settings.dailyNoteFormat}
                  aria-label="Daily note date format"
                  onChange={(e) => set('dailyNoteFormat', e.target.value || 'YYYY-MM-DD')}
                />
              </Row>
              <Row name="Template" desc="Applied when creating a daily note">
                <select
                  className="input"
                  value={settings.dailyNoteTemplateId ?? ''}
                  aria-label="Daily note template"
                  onChange={(e) => set('dailyNoteTemplateId', e.target.value || null)}
                >
                  <option value="">None</option>
                  {BUILTIN_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Row>
              <IcsImportRow />
            </>
          )}

          {section === 'Templates' && (
            <>
              <Row name="Templates folder" desc="Notes in this folder become templates">
                <input
                  className="input"
                  value={settings.templatesFolder}
                  aria-label="Templates folder"
                  onChange={(e) => set('templatesFolder', e.target.value)}
                />
              </Row>
              <p className="text-small text-secondary" style={{ paddingTop: 'var(--space-3)' }}>
                Built-in research templates (daily journal, literature note, experiment log,
                supervisor meeting, research question) are always available from the Templates panel
                and command palette. Your own template notes support <code>{'{{title}}'}</code>,{' '}
                <code>{'{{date}}'}</code>, <code>{'{{time}}'}</code> and{' '}
                <code>{'{{date:FORMAT}}'}</code> placeholders.
              </p>
            </>
          )}

          {section === 'Search' && (
            <p className="text-small text-secondary">
              Search runs entirely on this device in a background worker — nothing ever leaves your
              browser. The index is rebuilt incrementally when the vault opens and updated as you
              type. Supported operators: <code>"exact phrase"</code>, <code>-excluded</code>,{' '}
              <code>tag:name</code>, <code>path:Folder</code>, <code>type:experiment</code>, plus
              created/modified date filters in the search panel.
            </p>
          )}

          {section === 'Desktop' && isDesktopApp() && (
            <>
              <p className="text-small text-secondary" style={{ marginBottom: 'var(--space-3)' }}>
                These options apply to the Neoma desktop app only and are stored locally.
              </p>
              <Row name="When I close the window" desc="Choose what the close button does">
                <select
                  className="input"
                  value={settings.desktopCloseBehavior}
                  aria-label="Close behaviour"
                  onChange={(e) =>
                    set(
                      'desktopCloseBehavior',
                      e.target.value as ApplicationSettings['desktopCloseBehavior'],
                    )
                  }
                >
                  <option value="tray">Minimise to the tray</option>
                  <option value="quit">Quit Neoma completely</option>
                  <option value="ask">Ask me each time</option>
                </select>
              </Row>
              {desktopUpdates && (
                <Row name="Launch on startup" desc="Open Neoma automatically when you log in">
                  <Toggle
                    checked={settings.launchOnStartup}
                    onChange={(v) => {
                      set('launchOnStartup', v)
                      void setLaunchOnStartup(v)
                    }}
                    label="Launch on startup"
                  />
                </Row>
              )}
            </>
          )}

          {section === 'Backups' && (
            <>
              {canExportFiles() && (
                <Row name="Export settings" desc="Download all settings as JSON">
                  <button
                    className="btn"
                    onClick={() => {
                      void exportBlob(
                        new Blob([exportSettingsJson()], { type: 'application/json' }),
                        'neoma-settings.json',
                      ).catch((err) => {
                        if (err instanceof ExportCancelled) return
                        toast(err instanceof Error ? err.message : 'Export failed', 'error')
                      })
                    }}
                  >
                    Export settings
                  </button>
                </Row>
              )}
              <Row name="Import settings" desc="Restore settings from a JSON export">
                <button className="btn" onClick={() => importInput.current?.click()}>
                  Import settings
                </button>
              </Row>
              <Row
                name="Publish as a website"
                desc="Export the whole vault as a static HTML site (ZIP). Wiki-links, folders and attachments are included, so you can open it locally or host it anywhere."
              >
                <button className="btn" onClick={() => void runCommand('vault.publish-site')}>
                  Publish website
                </button>
              </Row>
              <div className="sidebar-section-label" style={{ padding: 'var(--space-3) 0 0' }}>
                Device sync
              </div>
              <DeviceSyncRows />
              <input
                ref={importInput}
                type="file"
                accept="application/json"
                className="visually-hidden"
                tabIndex={-1}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  try {
                    importSettingsJson(await file.text())
                    toast('Settings imported', 'success')
                  } catch {
                    toast('Not a valid settings file', 'error')
                  }
                }}
              />
              <p className="text-small text-secondary" style={{ paddingTop: 'var(--space-3)' }}>
                To back up your notes, use <strong>Export vault as ZIP</strong> from the file panel
                menu. Browser vaults live in this browser's storage, so export regularly, or use a
                local-folder vault for file-level backups and Git.
              </p>
            </>
          )}

          {section === 'Keyboard shortcuts' && (
            <>
              {listCommands()
                .filter((c) => c.shortcut || settings.customShortcuts[c.id])
                .map((c) => (
                  <Row key={c.id} name={c.title} desc={c.category}>
                    <input
                      className="input"
                      style={{ fontFamily: 'var(--font-mono)' }}
                      value={effectiveBinding(c.id, c.shortcut) ?? ''}
                      aria-label={`Shortcut for ${c.title}`}
                      onChange={(e) =>
                        set('customShortcuts', {
                          ...settings.customShortcuts,
                          [c.id]: e.target.value,
                        })
                      }
                    />
                  </Row>
                ))}
              <p className="text-small text-secondary" style={{ paddingTop: 'var(--space-3)' }}>
                Use <code>Mod</code> for Cmd (macOS) / Ctrl (Windows, Linux), e.g.{' '}
                <code>Mod+Shift+P</code>. Clear a field to restore the default.
              </p>
            </>
          )}

          {section === 'Privacy' && (
            <>
              <blockquote
                style={{
                  borderLeft: '3px solid var(--color-accent-muted)',
                  paddingLeft: 'var(--space-3)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {PRIVACY_STATEMENT}
              </blockquote>
              <ul
                className="text-small text-secondary"
                style={{
                  paddingLeft: '1.2rem',
                  marginTop: 'var(--space-3)',
                  display: 'grid',
                  gap: '0.3rem',
                }}
              >
                <li>No accounts, no cloud services, no remote databases</li>
                <li>No telemetry, analytics, advertisements or tracking pixels</li>
                <li>Remote images and videos are blocked unless you enable them</li>
                <li>All fonts, icons and scripts are bundled — nothing loads from CDNs</li>
                <li>Offline use is a fully supported, normal state</li>
              </ul>
              <p className="text-small" style={{ marginTop: 'var(--space-3)' }}>
                Read the full{' '}
                <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
                  Privacy Policy
                </a>{' '}
                and{' '}
                <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
                  Terms of Use
                </a>{' '}
                on neomadev.app.
              </p>
            </>
          )}

          {section === 'Acknowledgements' && (
            <div className="text-small text-secondary">
              {/* Attribution, not positioning. The MIT/ISC/Apache-2.0 licences
                  below require their notices to travel with a distributed
                  build, so this list must stay even though the App Store build
                  is shared by both editions; this repository is AGPL-3.0-or-later. */}
              <p>{APP_NAME} is built on these projects, with thanks to their authors:</p>
              <ul
                style={{
                  paddingLeft: '1.2rem',
                  marginTop: 'var(--space-2)',
                  display: 'grid',
                  gap: '0.25rem',
                }}
              >
                <li>React (MIT)</li>
                <li>CodeMirror 6 (MIT)</li>
                <li>unified / remark / rehype (MIT)</li>
                <li>KaTeX (MIT)</li>
                <li>Dexie.js (Apache-2.0)</li>
                <li>pdf.js (Apache-2.0)</li>
                <li>MiniSearch (MIT)</li>
                <li>fflate (MIT)</li>
                <li>Lucide icons (ISC)</li>
                <li>zustand (MIT)</li>
                <li>yaml (ISC)</li>
                <li>Vite &amp; vite-plugin-pwa (MIT)</li>
              </ul>
              <p style={{ marginTop: 'var(--space-2)' }}>
                See the{' '}
                <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">
                  License page
                </a>{' '}
                on neomadev.app for the full licence texts and complete third-party attributions.
              </p>
            </div>
          )}

          {section === 'About' && (
            <div>
              <h3 style={{ marginBottom: 'var(--space-1)' }}>
                {APP_NAME} <span className="text-faint text-small">v{APP_VERSION}</span>
              </h3>
              <p className="text-secondary">{APP_TAGLINE}</p>
              <p className="text-small text-secondary" style={{ marginTop: 'var(--space-3)' }}>
                A lightweight research journal and linked-note application. Created by {CREATOR}.
              </p>
              <p style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-2)' }}>
                <a className="btn" href={WEBSITE_URL} target="_blank" rel="noopener noreferrer">
                  Visit neomadev.app
                </a>
              </p>
              <p
                className="text-small"
                style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-3)' }}
              >
                <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
                  Privacy
                </a>
                <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
                  Terms
                </a>
                <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">
                  License
                </a>
              </p>
              <div style={{ marginTop: 'var(--space-3)' }}>
                <UpdatesRow />
              </div>
              {canInstall && (
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 'var(--space-3)' }}
                  onClick={() => void promptInstall()}
                >
                  Install neoma as an app
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
