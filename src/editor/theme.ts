// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * CodeMirror theme wired to neoma's CSS variables, so the editor follows the
 * active theme (including community themes) automatically.
 */
import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

export const editorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'transparent',
    color: 'var(--color-text)',
    height: '100%',
  },
  '.cm-content': {
    fontFamily: 'var(--font-ui)',
    caretColor: 'var(--color-accent)',
    padding: 'var(--space-5) 0',
    lineHeight: '1.68',
    maxWidth: 'var(--editor-line-width, 46rem)',
    margin: '0 auto',
  },
  '.cm-scroller': {
    fontFamily: 'var(--font-ui)',
    padding: '0 var(--space-6)',
  },
  '.cm-line': { padding: '0 2px' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--color-accent)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--color-selection) !important',
  },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--color-text-faint)',
    border: 'none',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--color-bg-raised)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text)',
    boxShadow: 'var(--shadow-overlay)',
  },
  '.cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'var(--color-accent-subtle)',
    color: 'var(--color-text)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--color-bg-raised)',
    color: 'var(--color-text)',
    borderColor: 'var(--color-border)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'var(--color-mark-bg)',
    outline: '1px solid var(--color-accent-muted)',
  },
  '.cm-placeholder': { color: 'var(--color-text-faint)' },
})

export const markdownHighlighting = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.heading1, fontSize: '1.5em', fontWeight: '650' },
    { tag: tags.heading2, fontSize: '1.3em', fontWeight: '650' },
    { tag: tags.heading3, fontSize: '1.15em', fontWeight: '650' },
    { tag: tags.heading4, fontWeight: '650' },
    { tag: tags.heading5, fontWeight: '650' },
    { tag: tags.heading6, fontWeight: '650', color: 'var(--color-text-secondary)' },
    { tag: tags.strong, fontWeight: '700' },
    { tag: tags.emphasis, fontStyle: 'italic' },
    { tag: tags.strikethrough, textDecoration: 'line-through' },
    { tag: tags.link, color: 'var(--color-accent)' },
    { tag: tags.url, color: 'var(--color-accent-muted)' },
    { tag: tags.quote, color: 'var(--color-text-secondary)', fontStyle: 'italic' },
    {
      tag: tags.monospace,
      fontFamily: 'var(--font-mono)',
      fontSize: '0.9em',
      color: 'var(--color-accent-muted)',
    },
    { tag: tags.meta, color: 'var(--color-text-faint)' },
    { tag: tags.processingInstruction, color: 'var(--color-text-faint)' },
    { tag: tags.labelName, color: 'var(--color-info)' },
    { tag: tags.comment, color: 'var(--color-text-faint)', fontStyle: 'italic' },
    { tag: tags.keyword, color: 'var(--color-info)' },
    { tag: tags.string, color: 'var(--color-accent-muted)' },
    { tag: tags.number, color: 'var(--color-warning)' },
    { tag: tags.contentSeparator, color: 'var(--color-text-faint)' },
    { tag: tags.list, color: 'var(--color-text)' },
  ]),
)
