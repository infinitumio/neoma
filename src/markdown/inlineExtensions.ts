// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Remark plugin adding neoma's inline syntax on top of CommonMark/GFM:
 *
 * - `[[Note]]`, `[[Note|Alias]]`, `[[Note#Heading]]` wiki links
 * - `![[file.png]]` embeds
 * - `==highlighted==` text
 * - `#tag` tags
 * - `[@citekey]` Pandoc-style citation keys (rendered, never rewritten)
 *
 * Each construct becomes an mdast node carrying `data.hName`/`hProperties`
 * so remark-rehype renders it without custom handlers.
 */
import type { Root, Parent, PhrasingContent } from 'mdast'
import { visit } from 'unist-util-visit'
import { parseWikiTarget } from './extractMeta'

export interface InlineExtensionOptions {
  /** Resolve a wiki-link target to a vault path, or null when broken. */
  resolveLink?: (target: string) => string | null
}

type Builder = (match: RegExpExecArray) => PhrasingContent | null

function splitTextNodes(tree: Root, regex: RegExp, build: Builder, skipInLinks = true): void {
  visit(tree, 'text', (node, index, parent) => {
    if (!parent || index === undefined) return
    const parentType = (parent as Parent).type
    if (skipInLinks && (parentType === 'link' || parentType === 'linkReference')) return
    const value = node.value
    regex.lastIndex = 0
    let match: RegExpExecArray | null
    let last = 0
    const out: PhrasingContent[] = []
    while ((match = regex.exec(value))) {
      const replacement = build(match)
      if (!replacement) continue
      if (match.index > last) out.push({ type: 'text', value: value.slice(last, match.index) })
      out.push(replacement)
      last = match.index + match[0].length
    }
    if (out.length === 0) return
    if (last < value.length) out.push({ type: 'text', value: value.slice(last) })
    ;(parent as Parent).children.splice(index, 1, ...out)
    return index + out.length
  })
}

const WIKI_RE = /(!?)\[\[([^\][\n]+?)\]\]/g
const HIGHLIGHT_RE = /==([^=\n](?:[^\n]*?[^=\n])?)==/g
const TAG_RE = /(^|[\s(])#([\p{L}\p{N}/_-]*[\p{L}/_-][\p{L}\p{N}/_-]*)/gu
const CITATION_RE = /\[(@[\w:.#$%&+?<>~/-]+(?:[^\]]*)?)\]/g
// Coloured highlight extension: only this exact shape (a documented, safe
// subset of HTML — a known colour, no other attributes) is recognised.
// Anything else stays subject to the default raw-HTML dropping.
const COLOR_MARK_OPEN_RE = /^<mark data-color="(yellow|green|blue|purple|red|orange|grey)">$/
const COLOR_MARK_CLOSE_RE = /^<\/mark>$/

/**
 * remark parses inline HTML into `html` nodes around ordinary children, e.g.
 * [html(<mark…>), text(…), html(</mark>)]. Find matching pairs of the safe
 * colour-mark shape and wrap the children between them in a <mark> element.
 * Unrecognised HTML is left alone (and dropped later, as always).
 */
function transformColorMarks(tree: Root): void {
  visit(tree, (node) => {
    const parent = node as Parent
    if (!('children' in parent) || !Array.isArray(parent.children)) return
    for (let i = 0; i < parent.children.length; i++) {
      const open = parent.children[i] as { type: string; value?: string }
      if (open.type !== 'html' || !open.value) continue
      const match = COLOR_MARK_OPEN_RE.exec(open.value)
      if (!match) continue
      for (let j = i + 1; j < parent.children.length; j++) {
        const close = parent.children[j] as { type: string; value?: string }
        if (close.type === 'html' && close.value && COLOR_MARK_CLOSE_RE.test(close.value)) {
          const inner = parent.children.slice(i + 1, j) as PhrasingContent[]
          const wrapper = {
            type: 'strong', // phrasing container; hName below overrides the tag
            data: { hName: 'mark', hProperties: { className: [`mark-${match[1]}`] } },
            children: inner,
          } as unknown as PhrasingContent
          parent.children.splice(i, j - i + 1, wrapper)
          break
        }
      }
    }
  })
}

export function remarkInlineExtensions(options: InlineExtensionOptions = {}) {
  const resolveLink = options.resolveLink ?? (() => null)
  return (tree: Root) => {
    splitTextNodes(tree, WIKI_RE, (m) => {
      const isEmbed = m[1] === '!'
      const { target, heading, alias } = parseWikiTarget(m[2])
      if (!target) return null
      if (isEmbed) {
        return {
          type: 'text',
          value: '',
          data: {
            hName: 'span',
            hProperties: { className: ['embed'], 'data-embed': target },
            hChildren: [{ type: 'text', value: target }],
          },
        } as PhrasingContent
      }
      const resolved = resolveLink(target)
      const label = alias ?? (heading ? `${target} › ${heading}` : target)
      return {
        type: 'text',
        value: '',
        data: {
          hName: 'a',
          hProperties: {
            className: ['wiki-link', ...(resolved ? [] : ['wiki-link-broken'])],
            'data-target': target,
            ...(heading ? { 'data-heading': heading } : {}),
            ...(resolved ? { 'data-resolved': resolved } : {}),
            href: '#',
          },
          hChildren: [{ type: 'text', value: label }],
        },
      } as PhrasingContent
    })

    splitTextNodes(tree, HIGHLIGHT_RE, (m) => {
      return {
        type: 'text',
        value: '',
        data: {
          hName: 'mark',
          hChildren: [{ type: 'text', value: m[1] }],
        },
      } as PhrasingContent
    })

    transformColorMarks(tree)

    splitTextNodes(tree, CITATION_RE, (m) => {
      return {
        type: 'text',
        value: '',
        data: {
          hName: 'span',
          hProperties: { className: ['citation'], 'data-citation': m[1] },
          hChildren: [{ type: 'text', value: `[${m[1]}]` }],
        },
      } as PhrasingContent
    })

    splitTextNodes(tree, TAG_RE, (m) => {
      if (/^\d+$/.test(m[2])) return null
      const prefix = m[1]
      return {
        type: 'text',
        value: '',
        data: {
          hName: 'span',
          hChildren: [
            ...(prefix ? [{ type: 'text' as const, value: prefix }] : []),
            {
              type: 'element' as const,
              tagName: 'a',
              properties: { className: ['tag'], 'data-tag': m[2], href: '#' },
              children: [{ type: 'text' as const, value: `#${m[2]}` }],
            },
          ],
        },
      } as PhrasingContent
    })
  }
}
