// SPDX-License-Identifier: AGPL-3.0-or-later
/** Autocompletion for `[[wiki links]]` and `#tags` while typing. */
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { getLinkGraph } from '@/app/vaultStore'

export function wikiLinkCompletion(context: CompletionContext): CompletionResult | null {
  const before = context.matchBefore(/\[\[([^\][]*)$/)
  if (!before) return null
  const graph = getLinkGraph()
  const query = before.text.slice(2).toLowerCase()
  const seen = new Set<string>()
  const options = []
  for (const meta of graph.all()) {
    const candidates = [
      meta.name,
      ...(meta.title !== meta.name ? [meta.title] : []),
      ...meta.aliases,
    ]
    for (const candidate of candidates) {
      const key = candidate.toLowerCase()
      if (seen.has(key)) continue
      if (query && !key.includes(query)) continue
      seen.add(key)
      options.push({
        label: candidate,
        detail: candidate === meta.name ? meta.path : `→ ${meta.name}`,
        apply: `${candidate}]]`,
        type: 'text',
      })
    }
  }
  options.sort((a, b) => a.label.length - b.label.length)
  return {
    from: before.from + 2,
    options: options.slice(0, 50),
    validFor: /^[^\][]*$/,
  }
}

export function tagCompletion(context: CompletionContext): CompletionResult | null {
  const before = context.matchBefore(/(?:^|\s)#([\w/-]*)$/)
  if (!before) return null
  const hash = before.text.indexOf('#')
  const query = before.text.slice(hash + 1).toLowerCase()
  const graph = getLinkGraph()
  const options = []
  for (const [tag, count] of graph.tagCounts()) {
    if (query && !tag.toLowerCase().startsWith(query)) continue
    options.push({ label: `#${tag}`, detail: `${count}`, apply: tag, type: 'keyword' })
  }
  if (!options.length) return null
  return { from: before.from + hash + 1, options: options.slice(0, 30), validFor: /^[\w/-]*$/ }
}
