// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Reading-view flashcards. A paragraph shaped like
 *
 *   Question:: What is entropy?
 *   Answer:: A measure of disorder.
 *
 * (or `Q:: … / A:: …`) becomes a flip card the reader can click to reveal the
 * answer. An optional `Topic::` / `Category::` line inside the block shows as a
 * label. The underlying markdown stays plain text, so it's still portable.
 */
import type { Root, Parent } from 'mdast'
import { visit } from 'unist-util-visit'

const CARD_RE =
  /^\s*(?:question|q)::\s*([\s\S]+?)\s*(?:answer|a)::\s*([\s\S]+?)\s*$/i
const TOPIC_RE = /\n?\s*(?:topic|category)::\s*(.+)\s*$/i

/** Concatenate a paragraph's visible text, keeping line breaks. */
function paragraphText(node: unknown): string {
  let out = ''
  visit(node as Root, (n) => {
    const t = n as { type: string; value?: string }
    if (t.type === 'text' || t.type === 'inlineCode') out += t.value ?? ''
    else if (t.type === 'break') out += '\n'
  })
  return out
}

function face(className: string, text: string) {
  return {
    type: 'element',
    tagName: 'div',
    properties: { className: ['flashcard-embed-face', className] },
    children: [{ type: 'text', value: text }],
  }
}

export function remarkFlashcards() {
  return (tree: Root) => {
    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || index === undefined) return
      let text = paragraphText(node)

      // Pull an optional Topic::/Category:: label off the end.
      let topic: string | undefined
      const topicMatch = TOPIC_RE.exec(text)
      if (topicMatch) {
        topic = topicMatch[1].trim()
        text = text.slice(0, topicMatch.index).trimEnd()
      }

      const m = CARD_RE.exec(text)
      if (!m) return
      const front = m[1].trim()
      const back = m[2].trim()
      if (!front || !back) return

      const faces = [face('flashcard-embed-front', front), face('flashcard-embed-back', back)]
      const inner = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['flashcard-embed-inner'] },
        children: faces,
      }
      const children: unknown[] = [inner]
      if (topic) {
        children.push({
          type: 'element',
          tagName: 'div',
          properties: { className: ['flashcard-embed-topic'] },
          children: [{ type: 'text', value: topic }],
        })
      }
      children.push({
        type: 'element',
        tagName: 'div',
        properties: { className: ['flashcard-embed-hint'] },
        children: [{ type: 'text', value: 'Click to flip' }],
      })

      const replacement = {
        type: 'paragraph',
        data: {
          hName: 'div',
          hProperties: {
            className: ['flashcard-embed'],
            'data-front': front,
            'data-back': back,
            role: 'button',
            tabindex: 0,
            'aria-label': `Flashcard: ${front}. Click to reveal the answer.`,
          },
          hChildren: children,
        },
        children: [],
      }
      ;(parent as Parent).children.splice(index, 1, replacement as never)
    })
  }
}
