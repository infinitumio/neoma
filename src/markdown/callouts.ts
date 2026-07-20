// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Remark plugin for callout blocks, compatible with the widely used
 * blockquote convention:
 *
 * > [!note] Optional title
 * > Body content…
 *
 * Supported types: note, info, tip, warning, danger, question, quote,
 * success, example. Unknown types fall back to `note` styling.
 */
import type { Root, Blockquote, Paragraph } from 'mdast'
import { visit } from 'unist-util-visit'

const CALLOUT_RE = /^\[!(\w+)\]([+-]?)\s*(.*)$/

const KNOWN_TYPES = new Set([
  'note',
  'info',
  'tip',
  'warning',
  'danger',
  'error',
  'question',
  'quote',
  'success',
  'example',
  'abstract',
  'todo',
])

export function remarkCallouts() {
  return (tree: Root) => {
    visit(tree, 'blockquote', (node: Blockquote) => {
      const first = node.children[0]
      if (!first || first.type !== 'paragraph') return
      const firstText = first.children[0]
      if (!firstText || firstText.type !== 'text') return
      const newline = firstText.value.indexOf('\n')
      const firstLine = newline === -1 ? firstText.value : firstText.value.slice(0, newline)
      const match = CALLOUT_RE.exec(firstLine)
      if (!match) return

      const rawType = match[1].toLowerCase()
      const type = KNOWN_TYPES.has(rawType) ? rawType : 'note'
      const title = match[3] || rawType.charAt(0).toUpperCase() + rawType.slice(1)

      // Remove the marker line from the first paragraph.
      if (newline === -1) {
        first.children.shift()
      } else {
        firstText.value = firstText.value.slice(newline + 1)
      }
      if (first.children.length === 0) node.children.shift()

      const titleNode: Paragraph = {
        type: 'paragraph',
        data: {
          hName: 'p',
          hProperties: { className: ['callout-title'] },
        },
        children: [{ type: 'text', value: title }],
      }
      node.children.unshift(titleNode)
      node.data = {
        ...node.data,
        hName: 'div',
        hProperties: {
          className: ['callout', `callout-${type}`],
          role: 'note',
          'aria-label': `${type} callout`,
        },
      }
    })
  }
}
