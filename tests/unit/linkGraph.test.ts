// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, beforeEach } from 'vitest'
import { LinkGraph } from '@/links/LinkGraph'
import { extractNoteMeta } from '@/markdown/extractMeta'

function meta(path: string, text: string) {
  return extractNoteMeta({ path, text, createdAt: 1, modifiedAt: 1 })
}

describe('LinkGraph', () => {
  let graph: LinkGraph

  beforeEach(() => {
    graph = new LinkGraph()
    graph.update(meta('A.md', 'Links to [[B]] and [[Missing]]'))
    graph.update(meta('Sub/B.md', '---\naliases:\n  - Bee\n---\nLinks to [[A]]'))
    graph.update(meta('Lonely.md', 'No links'))
  })

  it('resolves by name regardless of folder', () => {
    expect(graph.resolve('B')).toBe('Sub/B.md')
    expect(graph.resolve('b')).toBe('Sub/B.md')
  })

  it('resolves by alias and by path', () => {
    expect(graph.resolve('Bee')).toBe('Sub/B.md')
    expect(graph.resolve('Sub/B')).toBe('Sub/B.md')
  })

  it('returns null for unknown targets', () => {
    expect(graph.resolve('Missing')).toBeNull()
  })

  it('computes outgoing links with resolution', () => {
    const outgoing = graph.outgoing('A.md')
    expect(outgoing).toHaveLength(2)
    expect(outgoing[0].resolved).toBe('Sub/B.md')
    expect(outgoing[1].resolved).toBeNull()
  })

  it('computes backlinks', () => {
    const backlinks = graph.backlinks('Sub/B.md')
    expect(backlinks).toHaveLength(1)
    expect(backlinks[0].sourcePath).toBe('A.md')
  })

  it('flags orphans and broken links', () => {
    expect(graph.isOrphan('Lonely.md')).toBe(true)
    expect(graph.isOrphan('Sub/B.md')).toBe(false)
    expect(graph.brokenLinks('A.md').map((l) => l.target)).toEqual(['Missing'])
  })

  it('updates when notes are removed', () => {
    graph.remove('A.md')
    expect(graph.backlinks('Sub/B.md')).toHaveLength(0)
    expect(graph.resolve('A')).toBeNull()
  })

  it('counts tags across the vault', () => {
    graph.update(meta('T.md', '#x #y'))
    graph.update(meta('T2.md', '#x'))
    const counts = graph.tagCounts()
    expect(counts.get('x')).toBe(2)
    expect(counts.get('y')).toBe(1)
  })

  it('finds linking sources for rename planning', () => {
    const sources = graph.linkingSources('Sub/B.md')
    expect(sources).toHaveLength(1)
    expect(sources[0].meta.path).toBe('A.md')
    expect(sources[0].links).toHaveLength(1)
  })
})
