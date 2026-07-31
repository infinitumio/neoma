// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Module-level reference to the currently mounted editor view. Lets commands
 * that originate outside the editor (the command palette, menus) insert into
 * the active note without prop-drilling the EditorView.
 */
import type { EditorView } from '@codemirror/view'

let active: EditorView | null = null

export function setActiveView(view: EditorView | null): void {
  active = view
}

export function getActiveView(): EditorView | null {
  return active
}
