// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * CodeMirror editor wrapper for a single note. Only the active tab renders
 * one of these, so at most one EditorView exists at a time; per-note editor
 * state (cursor, history) is cached across tab switches.
 */
import { useEffect, useRef } from 'react'
import { EditorView } from '@codemirror/view'
import type { EditorState } from '@codemirror/state'
import { createEditorState } from '@/editor/createEditor'
import { updateNoteContent, saveNoteNow, saveAttachment } from '@/app/vaultStore'
import { useSettings } from '@/settings/settingsStore'
import { useUi } from '@/app/uiStore'

// Session cache of editor states so switching tabs keeps cursor + undo.
const stateCache = new Map<string, EditorState>()

export function clearEditorStateCache(): void {
  stateCache.clear()
}

interface EditorProps {
  path: string
  content: string
}

export function Editor({ path, content }: EditorProps) {
  const container = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const pathRef = useRef(path)
  pathRef.current = path
  const showLineNumbers = useSettings((s) => s.settings.showLineNumbers)
  const spellcheck = useSettings((s) => s.settings.spellcheck)

  useEffect(() => {
    if (!container.current) return
    const callbacks = {
      onChange: (text: string) => updateNoteContent(pathRef.current, text),
      onSave: () => {
        void saveNoteNow(pathRef.current).catch(() => {
          useUi.getState().toast('Could not save the note', 'error')
        })
      },
    }
    const options = { showLineNumbers, spellcheck }
    const cached = stateCache.get(path)
    // Reuse cached state only when it still matches the stored content
    // (content may have changed through link updates or conflict resolution).
    const state =
      cached && cached.doc.toString() === content
        ? cached
        : createEditorState(content, callbacks, options)
    const view = new EditorView({ state, parent: container.current })
    viewRef.current = view
    view.focus()

    const dom = view.dom
    const onPaste = (event: ClipboardEvent) => void handleFiles(event.clipboardData?.files, event)
    const onDrop = (event: DragEvent) => void handleFiles(event.dataTransfer?.files, event)

    async function handleFiles(files: FileList | null | undefined, event: Event) {
      if (!files || files.length === 0) return
      const accepted = [...files].filter(
        (f) => f.type.startsWith('image/') || f.type === 'application/pdf' || f.name.includes('.'),
      )
      if (!accepted.length) return
      event.preventDefault()
      for (const file of accepted) {
        const saved = await saveAttachment(file, file.name || `pasted-${Date.now()}.png`)
        if (!saved) continue
        const isImage = file.type.startsWith('image/')
        const link = isImage
          ? `![${file.name || 'image'}](${encodeURI(saved)})`
          : `[${file.name}](${encodeURI(saved)})`
        const { from, to } = view.state.selection.main
        view.dispatch({
          changes: { from, to, insert: link + '\n' },
          selection: { anchor: from + link.length + 1 },
        })
      }
      useUi.getState().toast('Attachment saved to vault', 'success')
    }

    dom.addEventListener('paste', onPaste)
    dom.addEventListener('drop', onDrop)

    return () => {
      dom.removeEventListener('paste', onPaste)
      dom.removeEventListener('drop', onDrop)
      stateCache.set(pathRef.current, view.state)
      view.destroy()
      viewRef.current = null
    }
    // Recreate the editor when the note or editor options change.
  }, [path, showLineNumbers, spellcheck]) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply external content changes (conflict resolution, link rewrites).
  // Keystrokes flow editor → store, so doc and content already match and
  // this only dispatches when the store changed underneath the editor.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (view.state.doc.toString() !== content) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } })
    }
  }, [content])

  return <div ref={container} className="editor-pane" data-testid="editor" />
}
