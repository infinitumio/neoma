// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Markdown extension registry.
 *
 * First-party syntax extensions (wiki links, callouts, math…) register here,
 * and a future plugin API can add entries through the same mechanism without
 * touching the render pipeline. Extensions run in `order` (ascending) and are
 * standard unified/remark/rehype plugins.
 */
import type { Plugin } from 'unified'

export interface MarkdownExtension {
  id: string
  description: string
  stage: 'remark' | 'rehype'
  order: number
  plugin: Plugin<any[], any, any>
  options?: unknown
}

const extensions = new Map<string, MarkdownExtension>()

export function registerMarkdownExtension(extension: MarkdownExtension): void {
  if (extensions.has(extension.id)) {
    throw new Error(`Markdown extension "${extension.id}" is already registered`)
  }
  extensions.set(extension.id, extension)
}

export function unregisterMarkdownExtension(id: string): void {
  extensions.delete(id)
}

export function getMarkdownExtensions(stage: 'remark' | 'rehype'): MarkdownExtension[] {
  return [...extensions.values()].filter((e) => e.stage === stage).sort((a, b) => a.order - b.order)
}
