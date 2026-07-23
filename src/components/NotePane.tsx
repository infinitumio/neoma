// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The main note view: loads the note, then renders the current editing mode
 * (edit / split / reading). Listens for heading-scroll requests from links.
 */
import { lazy, Suspense, useEffect, useState } from 'react'
import { Editor } from './Editor'
import { SourceView } from './SourceView'
import { ViewModeSwitcher } from './ViewModeSwitcher'
import { Breadcrumbs } from './Breadcrumbs'
import { MathSymbolMenu } from './MathSymbolMenu'
import { PageColorButton } from './PageColorButton'

// The preview pulls in the markdown pipeline + KaTeX; load it on demand so
// the initial bundle stays small for people who just want to type.
const Preview = lazy(() => import('./Preview').then((m) => ({ default: m.Preview })))
import { loadNote, useVault } from '@/app/vaultStore'
import { useUi } from '@/app/uiStore'
import { useSettings } from '@/settings/settingsStore'
import { slugify } from '@/utils/misc'

interface NotePaneProps {
  path: string
  /** Hide the breadcrumb trail (e.g. in the PDF split view, where it's noise). */
  hideBreadcrumbs?: boolean
}

export function NotePane({ path, hideBreadcrumbs }: NotePaneProps) {
  const editorMode = useUi((s) => s.editorMode)
  const note = useVault((s) => s.notes.get(path))
  const showBreadcrumbs = useSettings((s) => s.settings.showBreadcrumbs)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    setMissing(false)
    void loadNote(path).then((loaded) => {
      if (!loaded) setMissing(true)
    })
  }, [path])

  // Scroll to a heading when a `[[Note#Heading]]` link targeted this note.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ path: string; heading: string }>).detail
      if (detail.path !== path) return
      const slug = slugify(detail.heading)
      document.getElementById(slug)?.scrollIntoView({ block: 'start' })
    }
    window.addEventListener('neoma:scroll-to-heading', handler)
    return () => window.removeEventListener('neoma:scroll-to-heading', handler)
  }, [path])

  if (missing) {
    return (
      <div className="empty-state" role="alert">
        <p>This note could not be opened.</p>
        <p className="text-small text-secondary">{path}</p>
      </div>
    )
  }
  if (!note) {
    return (
      <div className="empty-state" aria-busy="true">
        <p>Opening…</p>
      </div>
    )
  }

  return (
    <div className="note-view">
      <div className="note-header">
        <div className="note-header-crumbs">
          {showBreadcrumbs && !hideBreadcrumbs && <Breadcrumbs path={path} />}
        </div>
        <div className="note-header-actions">
          <div className="note-header-tools">
            <PageColorButton path={path} />
            {editorMode !== 'reading' && editorMode !== 'source' && <MathSymbolMenu />}
          </div>
          <ViewModeSwitcher />
        </div>
      </div>
      <div className={`editor-area ${editorMode}`} data-mode={editorMode}>
        {(editorMode === 'edit' || editorMode === 'split') && (
          <Editor path={path} content={note.content} />
        )}
        {(editorMode === 'reading' || editorMode === 'split') && (
          <Suspense
            fallback={
              <div className="preview-pane" aria-busy="true">
                <p className="text-faint">Rendering…</p>
              </div>
            }
          >
            <Preview path={path} content={note.content} />
          </Suspense>
        )}
        {editorMode === 'source' && <SourceView content={note.content} />}
      </div>
    </div>
  )
}
