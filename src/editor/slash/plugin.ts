// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * CodeMirror integration for the slash menu. A view plugin detects when a `/`
 * trigger is active at the cursor and drives the menu store; a high-priority
 * keymap forwards navigation keys to the store while the menu is open. The
 * React overlay (SlashMenu) does the rendering.
 */
import { ViewPlugin, type ViewUpdate, keymap, type EditorView } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { useSlashMenu } from './store'
import { detectContext } from './context'

/** The `/` and the query after it, when the trigger is valid at the cursor. */
function activeTrigger(view: EditorView): { from: number; query: string } | null {
  const pos = view.state.selection.main.head
  if (!view.state.selection.main.empty) return null
  const line = view.state.doc.lineAt(pos)
  const textBefore = view.state.doc.sliceString(line.from, pos)
  // A `/` at line start or after whitespace, followed by query chars, up to
  // the cursor. Stops the menu once a space is typed after the query.
  const match = /(?:^|\s)\/([\w -]*)$/.exec(textBefore)
  if (!match) return null
  const slashIndex = textBefore.lastIndexOf('/' + match[1])
  return { from: line.from + slashIndex, query: match[1] }
}

const slashDetector = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate) {
      if (!update.docChanged && !update.selectionSet && !update.focusChanged) return
      const view = update.view
      const store = useSlashMenu.getState()
      const trigger = activeTrigger(view)

      if (!trigger || !view.hasFocus) {
        if (store.open) store.close()
        return
      }
      // Reading the cursor's screen coords requires layout access, which is
      // forbidden inside an update — defer it to the measure phase.
      const cursor = view.state.selection.main.head
      const context = detectContext(view)
      view.requestMeasure({
        read: () => view.coordsAtPos(cursor),
        write: (c) => {
          if (!c) return
          const s = useSlashMenu.getState()
          // Re-validate: the doc/selection may have moved before we measured.
          const t = activeTrigger(view)
          if (!t || !view.hasFocus) {
            if (s.open) s.close()
            return
          }
          const coords = { left: c.left, top: c.top, bottom: c.bottom }
          if (!s.open) {
            s.openMenu({ view, from: t.from, query: t.query, context, coords })
          } else {
            s.update({ query: t.query, context, coords })
          }
        },
      })
    }
  },
)

// While the menu is open these keys drive it; otherwise they fall through.
const slashKeymap = Prec.highest(
  keymap.of([
    {
      key: 'ArrowDown',
      run: () => {
        if (!useSlashMenu.getState().open) return false
        useSlashMenu.getState().move(1)
        return true
      },
    },
    {
      key: 'ArrowUp',
      run: () => {
        if (!useSlashMenu.getState().open) return false
        useSlashMenu.getState().move(-1)
        return true
      },
    },
    {
      key: 'Enter',
      run: () => {
        if (!useSlashMenu.getState().open) return false
        return useSlashMenu.getState().accept()
      },
    },
    {
      key: 'Tab',
      run: () => {
        if (!useSlashMenu.getState().open) return false
        return useSlashMenu.getState().accept()
      },
    },
    {
      key: 'Escape',
      run: () => {
        if (!useSlashMenu.getState().open) return false
        useSlashMenu.getState().close()
        return true
      },
    },
  ]),
)

export function slashMenuExtension() {
  return [slashKeymap, slashDetector]
}
