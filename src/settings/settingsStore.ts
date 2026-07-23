// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Application settings. Stored locally (localStorage) — never transmitted.
 * Settings can be exported/imported as JSON from Settings → Backups.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ApplicationSettings } from '@/types'

export const DEFAULT_SETTINGS: ApplicationSettings = {
  theme: 'dark',
  editorFontSize: 16,
  editorLineWidth: 46,
  showLineNumbers: false,
  spellcheck: false,
  defaultEditorMode: 'edit',
  autosaveDelayMs: 700,
  attachmentFolder: 'Attachments',
  dailyNotesFolder: 'Calendar',
  dailyNoteFormat: 'YYYY-MM-DD',
  dailyNoteTemplateId: 'daily-research-journal',
  templatesFolder: 'Templates',
  fileSortOrder: 'name',
  confirmBeforeDelete: true,
  reducedMotion: 'system',
  showTooltips: true,
  desktopCloseBehavior: 'tray',
  launchOnStartup: false,
  customShortcuts: {},
}

interface SettingsState {
  settings: ApplicationSettings
  update: <K extends keyof ApplicationSettings>(key: K, value: ApplicationSettings[K]) => void
  replaceAll: (settings: Partial<ApplicationSettings>) => void
  reset: () => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      update: (key, value) => set((state) => ({ settings: { ...state.settings, [key]: value } })),
      replaceAll: (incoming) =>
        set(() => ({ settings: { ...DEFAULT_SETTINGS, ...sanitize(incoming) } })),
      reset: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'neoma.settings',
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => ({
        ...current,
        settings: { ...DEFAULT_SETTINGS, ...(persisted as Partial<SettingsState>)?.settings },
      }),
    },
  ),
)

/** Keep only known keys with plausible types when importing settings JSON. */
function sanitize(incoming: Partial<ApplicationSettings>): Partial<ApplicationSettings> {
  const out: Partial<ApplicationSettings> = {}
  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof ApplicationSettings>) {
    const value = incoming[key]
    if (value === undefined) continue
    if (typeof value === typeof DEFAULT_SETTINGS[key]) {
      ;(out as Record<string, unknown>)[key] = value
    }
  }
  return out
}

export function exportSettingsJson(): string {
  return JSON.stringify(useSettings.getState().settings, null, 2)
}

export function importSettingsJson(json: string): void {
  const parsed = JSON.parse(json)
  if (!parsed || typeof parsed !== 'object') throw new Error('Not a settings file')
  useSettings.getState().replaceAll(parsed)
}

/** Apply theme + motion preferences to the document root. */
export function applyAppearance(settings: ApplicationSettings): void {
  const root = document.documentElement
  root.dataset.theme = settings.theme
  if (settings.reducedMotion === 'reduced') root.dataset.motion = 'reduced'
  else delete root.dataset.motion
  root.style.setProperty('--font-size-editor', `${settings.editorFontSize / 16}rem`)
  root.style.setProperty('--editor-line-width', `${settings.editorLineWidth}rem`)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', settings.theme === 'dark' ? '#141817' : '#f6f8f7')
}
