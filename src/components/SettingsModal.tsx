// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Settings dialog. Sections come from a small registry-style list so future
 * plugins can contribute panes. Everything is stored locally.
 */
import { useRef, useState, type ReactNode } from 'react'
import { Modal } from './Modal'
import { useUi } from '@/app/uiStore'
import { useVault } from '@/app/vaultStore'
import { parseIcs } from '@/calendar/ics'
import { loadIcs, saveIcs, clearIcs } from '@/calendar/icsStore'
import { useSettings, exportSettingsJson, importSettingsJson } from '@/settings/settingsStore'
import { isTauri, setLaunchOnStartup } from '@/desktop/tauri'
import type { ApplicationSettings } from '@/types'
import { BUILTIN_TEMPLATES } from '@/templates/builtins'
import { listCommands } from '@/commands/registry'
import { effectiveBinding } from '@/commands/shortcuts'
import { downloadBlob } from '@/storage/import-export'
import {
  APP_NAME,
  APP_TAGLINE,
  APP_VERSION,
  CREATOR,
  REPOSITORY_URL,
  PRIVACY_STATEMENT,
} from '@/app/about'
import { useInstallPrompt } from '@/app/usePwa'

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
  'Open-source licences',
  'About',
] as const

type Section = (typeof SECTIONS)[number]

export function SettingsModal() {
  const open = useUi((s) => s.settingsOpen)
  const setOpen = useUi((s) => s.setSettingsOpen)
  const toast = useUi((s) => s.toast)
  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const [section, setSection] = useState<Section>('Appearance')
  const importInput = useRef<HTMLInputElement>(null)
  const { canInstall, promptInstall } = useInstallPrompt()

  if (!open) return null

  const set = <K extends keyof ApplicationSettings>(key: K, value: ApplicationSettings[K]) =>
    update(key, value)

  return (
    <Modal title="Settings" onClose={() => setOpen(false)} wide initialFocus={false}>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.filter((name) => name !== 'Desktop' || isTauri()).map((name) => (
            <button key={name} aria-current={section === name} onClick={() => setSection(name)}>
              {name}
            </button>
          ))}
        </nav>
        <div className="settings-content">
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
                  className="input"
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
                  className="input"
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

          {section === 'Desktop' && isTauri() && (
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
            </>
          )}

          {section === 'Backups' && (
            <>
              <Row name="Export settings" desc="Download all settings as JSON">
                <button
                  className="btn"
                  onClick={() => {
                    downloadBlob(
                      new Blob([exportSettingsJson()], { type: 'application/json' }),
                      'neoma-settings.json',
                    )
                  }}
                >
                  Export settings
                </button>
              </Row>
              <Row name="Import settings" desc="Restore settings from a JSON export">
                <button className="btn" onClick={() => importInput.current?.click()}>
                  Import settings
                </button>
              </Row>
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
                menu. Browser vaults live in this browser's storage — export regularly, or use a
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
                <li>No external API calls and no hidden network requests</li>
                <li>All fonts, icons and scripts are bundled — nothing loads from CDNs</li>
                <li>Offline use is a fully supported, normal state</li>
              </ul>
            </>
          )}

          {section === 'Open-source licences' && (
            <div className="text-small text-secondary">
              <p>
                {APP_NAME} is free software, licensed under <strong>AGPL-3.0-or-later</strong>. It
                is built on these open-source projects:
              </p>
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
                <li>MiniSearch (MIT)</li>
                <li>fflate (MIT)</li>
                <li>Lucide icons (ISC)</li>
                <li>zustand (MIT)</li>
                <li>yaml (ISC)</li>
                <li>Vite &amp; vite-plugin-pwa (MIT)</li>
              </ul>
              <p style={{ marginTop: 'var(--space-2)' }}>
                Full licence texts ship with the source distribution ("node_modules" of the
                repository) and the repository's LICENSE file.
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
                A lightweight, open-source research journal and linked-note application. Created by{' '}
                {CREATOR} and community-driven.
              </p>
              <p style={{ marginTop: 'var(--space-3)' }}>
                <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
                  Source code and issue tracker
                </a>
              </p>
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
