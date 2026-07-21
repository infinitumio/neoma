// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Builds a configured CodeMirror 6 EditorState for a note. neoma does not
 * implement its own text engine — CodeMirror provides editing, history,
 * search and markdown syntax; neoma layers its extensions on top.
 */
import { EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  keymap,
  drawSelection,
  dropCursor,
  highlightSpecialChars,
  lineNumbers,
  placeholder,
  rectangularSelection,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { indentOnInput, bracketMatching } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, completionKeymap, closeBracketsKeymap } from '@codemirror/autocomplete'
import { editorTheme, markdownHighlighting } from './theme'
import { wikiLinkCompletion, tagCompletion } from './wikiLinkCompletion'
import { slashCommandCompletion } from './slashCommands'
import { slashIconSvg, type SlashIcon } from './slashIcons'
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleHighlight,
  toggleCode,
  insertWikiLink,
} from './markdownCommands'

export interface EditorCallbacks {
  onChange: (content: string) => void
  onSave: () => void
  /** Fired when the selection, document, or focus changes (for the
   *  floating formatting toolbar). */
  onSelectionChange?: (view: EditorView) => void
}

export interface EditorOptions {
  showLineNumbers: boolean
  spellcheck: boolean
}

export function buildExtensions(callbacks: EditorCallbacks, options: EditorOptions): Extension[] {
  return [
    history(),
    drawSelection(),
    dropCursor(),
    highlightSpecialChars(),
    indentOnInput(),
    bracketMatching(),
    rectangularSelection(),
    highlightSelectionMatches(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    markdownHighlighting,
    editorTheme,
    placeholder('Start writing…'),
    autocompletion({
      override: [slashCommandCompletion, wikiLinkCompletion, tagCompletion],
      icons: false,
      // Render a leading icon for slash-command options (others have none).
      addToOptions: [
        {
          position: 10,
          render(completion) {
            const name = (completion as { slashIcon?: SlashIcon }).slashIcon
            if (!name) return null
            const wrap = document.createElement('div')
            wrap.className = 'cm-slash-icon'
            wrap.innerHTML = slashIconSvg(name)
            return wrap
          },
        },
      ],
    }),
    options.showLineNumbers ? lineNumbers() : [],
    EditorView.contentAttributes.of({
      spellcheck: options.spellcheck ? 'true' : 'false',
      'aria-label': 'Note editor',
    }),
    keymap.of([
      { key: 'Mod-b', run: toggleBold },
      { key: 'Mod-i', run: toggleItalic },
      { key: 'Mod-Shift-x', run: toggleStrikethrough },
      { key: 'Mod-Shift-h', run: toggleHighlight },
      { key: 'Mod-e', run: toggleCode },
      { key: 'Mod-Shift-k', run: insertWikiLink },
      {
        key: 'Mod-s',
        run: () => {
          callbacks.onSave()
          return true
        },
      },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...completionKeymap,
      indentWithTab,
    ]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) callbacks.onChange(update.state.doc.toString())
      if (update.docChanged || update.selectionSet || update.focusChanged) {
        callbacks.onSelectionChange?.(update.view)
      }
    }),
  ]
}

export function createEditorState(
  content: string,
  callbacks: EditorCallbacks,
  options: EditorOptions,
): EditorState {
  return EditorState.create({ doc: content, extensions: buildExtensions(callbacks, options) })
}
