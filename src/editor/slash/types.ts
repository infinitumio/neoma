// SPDX-License-Identifier: AGPL-3.0-or-later
/** Types for the slash-command system. */
import type { EditorView } from '@codemirror/view'
import type { SlashIcon } from '../slashIcons'

/** Where the cursor is, used to prioritise relevant commands. */
export type EditorContext = 'list' | 'math' | 'heading' | 'table' | 'code' | 'quote' | null

export interface SlashCommandContext {
  /** the editor to insert into */
  view: EditorView
}

export interface SlashCommand {
  id: string
  title: string
  category: SlashCategory
  description: string
  icon: SlashIcon
  /** extra search terms (fuzzy-matched alongside the title) */
  keywords?: string[]
  /** default keybinding shown in the menu, e.g. "Mod+B" */
  shortcut?: string
  /** short usage example shown in the preview panel */
  example?: string
  /** contexts where this command should be boosted to the top */
  contexts?: Exclude<EditorContext, null>[]
  /** insert the content (the `/query` text is already removed) */
  run: (ctx: SlashCommandContext) => void
  /** when present and true, the command is shown but not runnable */
  disabledReason?: string
  /** an action that doesn't need an editor/active note (e.g. study mode) */
  global?: boolean
}

export type SlashCategory =
  | 'Favourites'
  | 'Recent'
  | 'Basic Text'
  | 'Lists'
  | 'Callouts'
  | 'Mathematics'
  | 'Research'
  | 'Study'
  | 'Media'
  | 'Embeds'
  | 'Organisation'
  | 'AI'

/** Fixed display order for category groups in the menu. */
export const CATEGORY_ORDER: SlashCategory[] = [
  'Favourites',
  'Recent',
  'Basic Text',
  'Lists',
  'Callouts',
  'Mathematics',
  'Research',
  'Study',
  'Media',
  'Embeds',
  'Organisation',
  'AI',
]

export type { SlashIcon }
