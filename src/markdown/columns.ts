// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Column layout for the reading view. Write content side by side — text next
 * to an image, a PDF next to notes, two columns of prose — with a portable,
 * plain-markdown fence:
 *
 *   :::columns
 *   Left column. Any markdown works here.
 *   |||
 *   Right column with an ![[image.png]].
 *   :::
 *
 * `:::columns` opens, `|||` starts the next column, `:::` closes. The inner
 * content is ordinary markdown (parsed normally), so everything — embeds,
 * math, lists — renders inside a column.
 */
import type { Root, RootContent } from 'mdast'
import { maskNonProse } from './extractMeta'

const OPEN_RE = /^:::\s*columns\b/i
const SEP_RE = /^\|\|\|$/
const CLOSE_RE = /^:::$/

/**
 * Ensure column fence lines (`:::columns`, `|||`, `:::`) each sit on their own
 * block by padding them with blank lines — otherwise CommonMark folds the
 * whole thing into a single paragraph. Fences inside code/math are ignored.
 */
export function normalizeColumns(body: string): string {
  if (!/^:::\s*columns\b/im.test(body)) return body
  const bodyLines = body.split('\n')
  const maskLines = maskNonProse(body).split('\n')
  const out: string[] = []
  for (let i = 0; i < bodyLines.length; i++) {
    const t = (maskLines[i] ?? '').trim()
    const isFence = OPEN_RE.test(t) || SEP_RE.test(t) || CLOSE_RE.test(t)
    if (isFence) {
      if (out.length && out[out.length - 1].trim() !== '') out.push('')
      out.push(bodyLines[i])
      out.push('')
    } else {
      out.push(bodyLines[i])
    }
  }
  return out.join('\n')
}

/** The trimmed text of a paragraph made only of text nodes, else null. */
function fenceText(node: RootContent): string | null {
  if (node.type !== 'paragraph') return null
  let text = ''
  for (const child of node.children) {
    if (child.type === 'text') text += child.value
    else return null
  }
  return text.trim()
}

function columnNode(children: RootContent[]) {
  return {
    type: 'column',
    data: { hName: 'div', hProperties: { className: ['md-column'] } },
    children,
  } as unknown as RootContent
}

export function remarkColumns() {
  return (tree: Root) => {
    const children = tree.children
    for (let i = 0; i < children.length; i++) {
      const openText = fenceText(children[i])
      if (!openText || !OPEN_RE.test(openText)) continue

      // Find the matching close fence.
      let close = -1
      for (let j = i + 1; j < children.length; j++) {
        const t = fenceText(children[j])
        if (t && CLOSE_RE.test(t)) {
          close = j
          break
        }
      }
      if (close === -1) continue

      // Split the inner nodes into columns at `|||` separators.
      const columns: RootContent[][] = [[]]
      for (let k = i + 1; k < close; k++) {
        const t = fenceText(children[k])
        if (t && SEP_RE.test(t)) columns.push([])
        else columns[columns.length - 1].push(children[k])
      }

      const container = {
        type: 'columns',
        data: { hName: 'div', hProperties: { className: ['md-columns'] } },
        children: columns.map(columnNode),
      } as unknown as RootContent

      children.splice(i, close - i + 1, container)
      // Continue after the inserted container.
    }
  }
}
