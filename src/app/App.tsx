// SPDX-License-Identifier: AGPL-3.0-or-later
/** Application root: welcome flow or workspace, plus global chrome. */
import { lazy, Suspense, useEffect } from 'react'
import { Columns2, BookOpen } from 'lucide-react'
import type { TabState } from '@/types'
import { WelcomeScreen } from '@/components/WelcomeScreen'
import { FlashcardReview } from '@/components/FlashcardReview'
import { useStudy } from '@/study/studyStore'
import { ActivityRail } from '@/components/ActivityRail'
import { Sidebar } from '@/components/Sidebar'
import { TabsBar } from '@/components/TabsBar'
import { NotePane } from '@/components/NotePane'
import { clearEditorStateCache } from '@/components/Editor'
import { RightSidebar } from '@/components/RightSidebar'
import { StatusBar } from '@/components/StatusBar'
import { CommandPalette } from '@/components/CommandPalette'
import { SettingsModal } from '@/components/SettingsModal'
import { HelpModal } from '@/components/HelpModal'
import { VaultSwitcher } from '@/components/VaultSwitcher'
import { AttachmentPicker } from '@/components/AttachmentPicker'
import { CalendarRefPicker } from '@/components/CalendarRefPicker'
import { SlashMenu } from '@/components/SlashMenu'
import { Tooltips } from '@/components/Tooltips'
import { Dialogs } from '@/components/Dialogs'
import { Toasts } from '@/components/Toasts'
import { useVault, flushAllSaves, openVault, createNote, createFolder } from './vaultStore'
import { basename, dirname, joinPath } from '@/utils/paths'
import { listVaults } from '@/storage/VaultManager'
import { useTabs } from './tabsStore'
import { useUi } from './uiStore'
import { useSettings, applyAppearance } from '@/settings/settingsStore'
import { registerCommands } from '@/commands/registry'
import { buildDefaultCommands } from '@/commands/defaultCommands'
import { handleGlobalKeydown } from '@/commands/shortcuts'
import { formatShortcut } from '@/utils/misc'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { initDesktopIntegration, syncCloseBehavior } from '@/desktop/tauri'

// The graph loads only when opened, keeping it out of the initial bundle.
const GraphView = lazy(() => import('@/graph/GraphView'))
const CalendarView = lazy(() => import('@/components/CalendarView'))
const PdfViewer = lazy(() =>
  import('@/components/PdfViewer').then((m) => ({ default: m.PdfViewer })),
)

/** A PDF tab, optionally split with a companion note for paraphrasing. */
function PdfTab({ tab, vaultId }: { tab: TabState; vaultId: string | undefined }) {
  const setSplit = useTabs((s) => s.setPdfSplitNote)
  const path = tab.path as string

  const toggleSplit = async () => {
    if (tab.pdfSplitNote) {
      setSplit(tab.id, undefined)
      return
    }
    // Put the companion note inside a folder named after the PDF, so the tree
    // nests it under the PDF (see FileTree.buildTree) without moving the file.
    const stem = basename(path).replace(/\.pdf$/i, '')
    const folder = joinPath(dirname(path), stem)
    await createFolder(dirname(path), stem).catch(() => {})
    const desired = joinPath(folder, `${stem} — notes.md`)
    const existing = useVault.getState().entries.has(desired)
    const notePath = existing
      ? desired
      : await createNote(
          folder,
          `${stem} — notes`,
          `# ${stem} — notes\n\nParaphrasing [[${basename(path)}]]\n\n`,
        )
    if (notePath) setSplit(tab.id, notePath)
  }

  const splitButton = (
    <button
      className={`icon-btn${tab.pdfSplitNote ? ' active' : ''}`}
      aria-label={tab.pdfSplitNote ? 'Close split note' : 'Open note beside PDF'}
      aria-pressed={!!tab.pdfSplitNote}
      title={tab.pdfSplitNote ? 'Close split note' : 'Open note beside PDF'}
      onClick={() => void toggleSplit()}
    >
      <Columns2 size={16} aria-hidden />
    </button>
  )

  if (tab.pdfSplitNote) {
    return (
      <div className="pdf-split">
        <div className="pdf-split-pane">
          <PdfViewer path={path} initialPage={tab.pdfPage} toolbarExtra={splitButton} />
        </div>
        <div className="pdf-split-pane pdf-split-note">
          <NotePane
            key={`${vaultId}:${tab.pdfSplitNote}`}
            path={tab.pdfSplitNote}
            hideBreadcrumbs
          />
        </div>
      </div>
    )
  }
  return <PdfViewer path={path} initialPage={tab.pdfPage} toolbarExtra={splitButton} />
}

function EmptyWorkspace() {
  return (
    <div className="empty-state">
      <p>No note open</p>
      <div className="shortcut-hints">
        <span className="kbd">{formatShortcut('Mod+O')}</span>
        <span>Open a note</span>
        <span className="kbd">{formatShortcut('Mod+Alt+N')}</span>
        <span>Create a note</span>
        <span className="kbd">{formatShortcut('Mod+K')}</span>
        <span>Command palette</span>
      </div>
    </div>
  )
}

function Workspace() {
  const activeTab = useTabs((s) => s.tabs.find((t) => t.id === s.activeId))
  const vaultId = useVault((s) => s.vault?.id)
  const isMobile = useIsMobile()
  const studyMode = useStudy((s) => s.studyMode)

  // Study mode: exit on Escape.
  useEffect(() => {
    if (!studyMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useStudy.getState().setStudyMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [studyMode])

  // Editor state is cached by path; two vaults can share a path (e.g.
  // Untitled.md), so clear the cache whenever the vault changes.
  useEffect(() => {
    clearEditorStateCache()
  }, [vaultId])

  // On small screens the sidebar is a drawer: start closed, and close it
  // whenever a note is opened so the editor gets the full width.
  useEffect(() => {
    if (isMobile) useUi.getState().setSidebarOpen(false)
  }, [isMobile])
  useEffect(() => {
    if (isMobile && activeTab) useUi.getState().setSidebarOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.id, activeTab?.path])

  return (
    <div className={`app-shell${studyMode ? ' study-mode' : ''}`}>
      {studyMode && (
        <button
          className="btn btn-small study-exit"
          onClick={() => useStudy.getState().setStudyMode(false)}
        >
          <BookOpen size={14} aria-hidden /> Exit study mode <span className="kbd">Esc</span>
        </button>
      )}
      <ActivityRail />
      <Sidebar />
      <div className="main-area">
        <TabsBar />
        {!activeTab && <EmptyWorkspace />}
        {activeTab?.type === 'note' && activeTab.path && (
          <NotePane key={`${vaultId}:${activeTab.path}`} path={activeTab.path} />
        )}
        {activeTab?.type === 'graph' && (
          <Suspense
            fallback={
              <div className="empty-state" aria-busy="true">
                <p>Loading graph…</p>
              </div>
            }
          >
            <GraphView />
          </Suspense>
        )}
        {activeTab?.type === 'pdf' && activeTab.path && (
          <Suspense
            fallback={
              <div className="empty-state" aria-busy="true">
                <p>Loading PDF viewer…</p>
              </div>
            }
          >
            <PdfTab key={`${vaultId}:${activeTab.id}`} tab={activeTab} vaultId={vaultId} />
          </Suspense>
        )}
        {activeTab?.type === 'calendar' && (
          <Suspense
            fallback={
              <div className="empty-state" aria-busy="true">
                <p>Loading calendar…</p>
              </div>
            }
          >
            <CalendarView />
          </Suspense>
        )}
        <StatusBar />
      </div>
      <RightSidebar />
    </div>
  )
}

export default function App() {
  const status = useVault((s) => s.status)
  const settings = useSettings((s) => s.settings)

  // Register first-party commands once.
  useEffect(() => registerCommands(buildDefaultCommands()), [])

  // Reopen the last vault on startup (restores the whole workspace).
  useEffect(() => {
    const lastVault = localStorage.getItem('neoma.lastVault')
    if (!lastVault || useVault.getState().status !== 'closed') return
    void listVaults().then((vaults) => {
      const vault = vaults.find((v) => v.id === lastVault)
      if (vault && useVault.getState().status === 'closed') void openVault(vault)
    })
  }, [])

  // Appearance follows settings.
  useEffect(() => applyAppearance(settings), [settings])

  // Apply the configured default editor mode when the app starts.
  useEffect(() => {
    useUi.getState().setEditorMode(useSettings.getState().settings.defaultEditorMode)
  }, [])

  // Desktop (Tauri) native integration — a no-op in the browser build.
  useEffect(() => {
    let cleanup = () => {}
    void initDesktopIntegration(() => useSettings.getState().settings.desktopCloseBehavior).then(
      (fn) => {
        cleanup = fn
      },
    )
    return () => cleanup()
  }, [])
  // Keep the native close handler in sync with the setting.
  useEffect(() => {
    void syncCloseBehavior(settings.desktopCloseBehavior)
  }, [settings.desktopCloseBehavior])

  // Global shortcuts + never lose unsaved work on tab close.
  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => handleGlobalKeydown(event)
    const onBeforeUnload = () => flushAllSaves()
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushAllSaves()
    })
    return () => {
      window.removeEventListener('keydown', onKeydown)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  const showWorkspace = status === 'ready' || status === 'permission' || status === 'opening'

  return (
    <>
      {showWorkspace ? <Workspace /> : <WelcomeScreen />}
      <CommandPalette />
      <SettingsModal />
      <HelpModal />
      <VaultSwitcher />
      <AttachmentPicker />
      <CalendarRefPicker />
      <SlashMenu />
      <FlashcardReview />
      <Tooltips />
      <Dialogs />
      <Toasts />
    </>
  )
}
