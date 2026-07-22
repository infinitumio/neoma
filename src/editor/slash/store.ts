// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Transient state for the slash menu. The CodeMirror plugin drives open/close
 * and query; the React overlay renders from here; the keymap calls the
 * navigation/accept actions. Results are recomputed from the shared registry
 * so the keymap and the UI never disagree.
 */
import { create } from 'zustand'
import type { EditorView } from '@codemirror/view'
import type { EditorContext } from './types'
import { rankSlashCommands, type RankedCommand } from './registry'
import { recordUsage } from './usage'

interface SlashState {
  open: boolean
  view: EditorView | null
  /** doc position of the `/` trigger */
  from: number
  /** viewport coords of the cursor, for positioning */
  coords: { left: number; top: number; bottom: number } | null
  query: string
  context: EditorContext
  selectedIndex: number

  openMenu: (payload: {
    view: EditorView
    from: number
    query: string
    context: EditorContext
    coords: { left: number; top: number; bottom: number }
  }) => void
  update: (payload: {
    query: string
    context: EditorContext
    coords: { left: number; top: number; bottom: number }
  }) => void
  close: () => void
  move: (delta: number) => void
  setIndex: (index: number) => void
  accept: () => boolean
  acceptId: (id: string) => boolean
  results: () => RankedCommand[]
}

export const useSlashMenu = create<SlashState>((set, get) => ({
  open: false,
  view: null,
  from: 0,
  coords: null,
  query: '',
  context: null,
  selectedIndex: 0,

  openMenu: ({ view, from, query, context, coords }) =>
    set({ open: true, view, from, query, context, coords, selectedIndex: 0 }),

  update: ({ query, context, coords }) => {
    const prev = get()
    set({
      query,
      context,
      coords,
      // Keep the selection stable unless the query changed.
      selectedIndex: prev.query === query ? prev.selectedIndex : 0,
    })
  },

  close: () => set({ open: false, view: null, coords: null, query: '', selectedIndex: 0 }),

  results: () => rankSlashCommands(get().query, get().context),

  move: (delta) => {
    const results = get().results()
    if (results.length === 0) return
    const next = (get().selectedIndex + delta + results.length) % results.length
    set({ selectedIndex: next })
  },

  setIndex: (index) => set({ selectedIndex: index }),

  accept: () => {
    const chosen = get().results()[get().selectedIndex]?.command
    return chosen ? runChosen(get, chosen) : false
  },

  acceptId: (id) => {
    const chosen = get()
      .results()
      .find((r) => r.command.id === id)?.command
    return chosen ? runChosen(get, chosen) : false
  },
}))

function runChosen(get: () => SlashState, chosen: RankedCommand['command']): boolean {
  const { view, from } = get()
  if (!view || chosen.disabledReason) return false
  // Remove the `/query` trigger, then run the command's insertion.
  const to = view.state.selection.main.head
  view.dispatch({ changes: { from, to, insert: '' }, userEvent: 'delete' })
  get().close()
  chosen.run({ view })
  recordUsage(chosen.id)
  return true
}
