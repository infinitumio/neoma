// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The note → HTML render pipeline used by the reading view and split
 * preview. Raw HTML in notes is never passed through, so rendered output is
 * safe to inject. Wiki links, tags and embeds become annotated elements the
 * Preview component wires up for navigation.
 */
import { unified, type Processor } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import type { Root as HastRoot, Element } from 'hast'
import { remarkInlineExtensions } from './inlineExtensions'
import { remarkCallouts } from './callouts'
import { remarkFlashcards } from './flashcardCard'
import { getMarkdownExtensions } from './registry'
import { parseFrontmatter } from './frontmatter'
import { maskNonProse } from './extractMeta'

const WIKI_SPAN_RE = /(!?)\[\[([^\][\n]+?)\]\]/g

/**
 * Replace every prose `[[…]]` / `![[…]]` span with an opaque placeholder token
 * (U+E000 WL<index> U+E001) so its contents survive CommonMark inline parsing
 * verbatim — otherwise `_`/`*` inside a target become emphasis and the span is
 * split across nodes, never matching. Code and math are skipped via
 * maskNonProse (offsets are preserved). remarkInlineExtensions restores them.
 */
function protectWikiSpans(body: string): { text: string; tokens: string[] } {
  const masked = maskNonProse(body)
  const tokens: string[] = []
  let out = ''
  let last = 0
  for (const m of masked.matchAll(WIKI_SPAN_RE)) {
    const start = m.index ?? 0
    const end = start + m[0].length
    out += body.slice(last, start)
    const index = tokens.push(body.slice(start, end)) - 1
    out += `WL${index}`
    last = end
  }
  out += body.slice(last)
  return { text: out, tokens }
}

export interface RenderOptions {
  resolveLink?: (target: string) => string | null
}

/** Annotate anchors: external links open safely, local links stay internal. */
function rehypeLinkBehaviour() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return
      const href = node.properties?.href
      if (typeof href !== 'string') return
      const className = Array.isArray(node.properties.className)
        ? (node.properties.className as string[])
        : []
      if (className.includes('wiki-link') || className.includes('tag')) return
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
        node.properties.target = '_blank'
        node.properties.rel = ['noopener', 'noreferrer']
        node.properties.className = [...className, 'external-link']
      } else if (!href.startsWith('#')) {
        // Relative link into the vault (e.g. `[Note](Other%20Note.md)`).
        node.properties['data-internal'] = decodeURIComponent(href)
        node.properties.href = '#'
      }
    })
  }
}

function buildProcessor(
  options: RenderOptions,
  wikiTokens: string[],
): Processor<any, any, any, any, string> {
  const processor: any = unified().use(remarkParse).use(remarkGfm).use(remarkMath)
  processor.use(remarkCallouts)
  processor.use(remarkFlashcards)
  processor.use(remarkInlineExtensions, { resolveLink: options.resolveLink, wikiTokens })
  for (const ext of getMarkdownExtensions('remark')) {
    processor.use(ext.plugin, ext.options as any)
  }
  processor.use(remarkRehype)
  processor.use(rehypeSlug)
  processor.use(rehypeKatex, { errorColor: 'var(--color-error)', throwOnError: false })
  processor.use(rehypeLinkBehaviour)
  for (const ext of getMarkdownExtensions('rehype')) {
    processor.use(ext.plugin, ext.options as any)
  }
  processor.use(rehypeStringify)
  return processor as Processor<any, any, any, any, string>
}

/** Render a full note (frontmatter is stripped, not rendered). */
export async function renderMarkdown(text: string, options: RenderOptions = {}): Promise<string> {
  const { body } = parseFrontmatter(text)
  const { text: protectedBody, tokens } = protectWikiSpans(body)
  const file = await buildProcessor(options, tokens).process(protectedBody)
  return String(file)
}
