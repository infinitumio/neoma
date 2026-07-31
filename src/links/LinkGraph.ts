// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Main-thread link graph. Holds NoteMeta for every note and answers link
 * questions: resolution, backlinks, broken links, orphans. Backlink context
 * excerpts are fetched separately from the index worker.
 */
import type { LinkIndex, NoteMeta, WikiLink } from '@/types'
import { normalizePath, stem, dirname, joinPath } from '@/utils/paths'

export class LinkGraph implements LinkIndex {
  private metas = new Map<string, NoteMeta>()
  /** lower-cased note name / alias / extension-less path → paths */
  private names = new Map<string, Set<string>>()

  private addName(key: string, path: string): void {
    const lower = key.toLowerCase()
    let set = this.names.get(lower)
    if (!set) this.names.set(lower, (set = new Set()))
    set.add(path)
  }

  private removeNames(meta: NoteMeta): void {
    const keys = [meta.name, meta.title, ...meta.aliases, meta.path.replace(/\.md$/i, '')]
    for (const key of keys) {
      const set = this.names.get(key.toLowerCase())
      if (set) {
        set.delete(meta.path)
        if (set.size === 0) this.names.delete(key.toLowerCase())
      }
    }
  }

  update(meta: NoteMeta): void {
    const existing = this.metas.get(meta.path)
    if (existing) this.removeNames(existing)
    this.metas.set(meta.path, meta)
    this.addName(meta.name, meta.path)
    this.addName(meta.title, meta.path)
    this.addName(meta.path.replace(/\.md$/i, ''), meta.path)
    for (const alias of meta.aliases) this.addName(alias, meta.path)
  }

  remove(path: string): void {
    const meta = this.metas.get(path)
    if (!meta) return
    this.removeNames(meta)
    this.metas.delete(path)
  }

  get(path: string): NoteMeta | undefined {
    return this.metas.get(path)
  }

  all(): NoteMeta[] {
    return [...this.metas.values()]
  }

  /**
   * Resolve `target` (as written in a wiki link) to a note path.
   * Precedence: exact vault path → note name/alias (shortest path wins) →
   * path relative to the linking note.
   */
  resolve(target: string, fromPath?: string): string | null {
    const clean = normalizePath(target.replace(/\.md$/i, ''))
    if (!clean) return null
    const direct = this.metas.get(clean + '.md')
    if (direct) return direct.path
    const byName = this.names.get(clean.toLowerCase())
    if (byName && byName.size > 0) {
      return [...byName].sort((a, b) => a.length - b.length || a.localeCompare(b))[0]
    }
    if (fromPath) {
      const relative = joinPath(dirname(fromPath), clean) + '.md'
      if (this.metas.has(relative)) return relative
    }
    return null
  }

  outgoing(path: string): Array<{ link: WikiLink; resolved: string | null }> {
    const meta = this.metas.get(path)
    if (!meta) return []
    return meta.links.map((link) => ({ link, resolved: this.resolve(link.target, path) }))
  }

  /** Sources that link to `path`, with the offset of each linking mention. */
  backlinkSources(path: string): Array<{ meta: NoteMeta; link: WikiLink }> {
    const results: Array<{ meta: NoteMeta; link: WikiLink }> = []
    for (const meta of this.metas.values()) {
      if (meta.path === path) continue
      for (const link of meta.links) {
        if (this.resolve(link.target, meta.path) === path) {
          results.push({ meta, link })
        }
      }
    }
    return results
  }

  backlinks(path: string): Array<{ sourcePath: string; sourceTitle: string; context: string }> {
    return this.backlinkSources(path).map(({ meta, link }) => ({
      sourcePath: meta.path,
      sourceTitle: meta.title,
      context: link.raw,
    }))
  }

  isOrphan(path: string): boolean {
    return this.backlinkSources(path).length === 0
  }

  brokenLinks(path: string): WikiLink[] {
    return this.outgoing(path)
      .filter(({ resolved }) => resolved === null)
      .map(({ link }) => link)
  }

  /** Names/terms suitable for the unlinked-mentions scan of a note. */
  mentionTerms(path: string): string[] {
    const meta = this.metas.get(path)
    if (!meta) return []
    return [...new Set([meta.name, meta.title, ...meta.aliases])].filter((t) => t.length > 2)
  }

  /** All tags in the vault with usage counts. */
  tagCounts(): Map<string, number> {
    const counts = new Map<string, number>()
    for (const meta of this.metas.values()) {
      for (const tag of meta.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return counts
  }

  clear(): void {
    this.metas.clear()
    this.names.clear()
  }

  /** Notes whose text contains links pointing at `target` (for renames). */
  linkingSources(targetPath: string): Array<{ meta: NoteMeta; links: WikiLink[] }> {
    const out: Array<{ meta: NoteMeta; links: WikiLink[] }> = []
    for (const meta of this.metas.values()) {
      const links = meta.links.filter((l) => this.resolve(l.target, meta.path) === targetPath)
      if (links.length) out.push({ meta, links })
    }
    return out
  }
}

export { stem }
