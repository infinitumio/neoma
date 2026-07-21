// SPDX-License-Identifier: AGPL-3.0-or-later
/** Application root: welcome flow or workspace, plus global chrome. */
import { lazy, Suspense, useEffect } from 'react'
import { WelcomeScreen } from '@/components/WelcomeScreen'
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
import { SlashMenu } from '@/components/SlashMenu'
import { Dialogs } from '@/components/Dialogs'
import { Toasts } from '@/components/Toasts'
import { useVault, flushAllSaves, openVault } from './vaultStore'
import { listVaults } from '@/storage/VaultManager'
import { useTabs } from './tabsStore'
import { useUi } from './uiStore'
import { useSettings, applyAppearance } from '@/settings/settingsStore'
import { registerCommands } from '@/commands/registry'
import { buildDefaultCommands } from '@/commands/defaultCommands'
import { handleGlobalKeydown } from '@/commands/shortcuts'
import { formatShortcut } from '@/utils/misc'
import { useIsMobile } from '@/hooks/useMediaQuery'

// The graph loads only when opened, keeping it out of the initial bundle.
const GraphView = lazy(() => import('@/graph/GraphView'))
const PdfViewer = lazy(() =>
  import('@/components/PdfViewer').then((m) => ({ default: m.PdfViewer })),
)

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
    <div className="app-shell">
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
            <PdfViewer key={`${vaultId}:${activeTab.path}`} path={activeTab.path} />
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
      <SlashMenu />
      <Dialogs />
      <Toasts />
    </>
  )
}
