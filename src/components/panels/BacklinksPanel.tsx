// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Link intelligence for the active note: incoming links (with context),
 * outgoing links, unlinked mentions, broken links and orphan status.
 * Used both in the left rail panel and the right contextual sidebar.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link2, Link2Off, Unlink } from 'lucide-react'
import { getLinkGraph, getSearch, useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { openNoteByTarget } from '@/app/navigation'
import type { SearchResultItem } from '@/types'

export function useActiveNotePath(): string | null {
  const active = useTabs((s) => s.tabs.find((t) => t.id === s.activeId))
  return active?.type === 'note' ? (active.path ?? null) : null
}

export function BacklinksContent({ path }: { path: string }) {
  const metaVersion = useVault((s) => s.metaVersion)
  const openNote = useTabs((s) => s.openNote)
  const [contexts, setContexts] = useState<Map<string, string>>(new Map())
  const [mentions, setMentions] = useState<SearchResultItem[]>([])

  const graph = getLinkGraph()
  const backlinks = useMemo(() => {
    void metaVersion
    return graph.backlinkSources(path)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, metaVersion])

  const outgoing = useMemo(() => {
    void metaVersion
    return graph.outgoing(path)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, metaVersion])

  const broken = outgoing.filter((o) => o.resolved === null)
  const isOrphan = backlinks.length === 0

  // Fetch line context for each backlink from the worker.
  useEffect(() => {
    const search = getSearch()
    if (!search || backlinks.length === 0) {
      setContexts(new Map())
      return
    }
    let cancelled = false
    const items = backlinks.map(({ meta, link }) => ({ path: meta.path, offset: link.offset }))
    void search.contexts(items).then((lines) => {
      if (cancelled) return
      const map = new Map<string, string>()
      backlinks.forEach(({ meta, link }, i) => map.set(`${meta.path}:${link.offset}`, lines[i]))
      setContexts(map)
    })
    return () => {
      cancelled = true
    }
  }, [backlinks])

  // Unlinked mentions of this note's name/aliases.
  useEffect(() => {
    const search = getSearch()
    const terms = graph.mentionTerms(path)
    if (!search || !terms.length) {
      setMentions([])
      return
    }
    let cancelled = false
    void search.mentions(terms, path).then((results) => {
      if (!cancelled) {
        const linkedFrom = new Set(backlinks.map((b) => b.meta.path))
        setMentions(results.filter((r) => !linkedFrom.has(r.path)))
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, metaVersion])

  return (
    <div>
      <div className="sidebar-section-label">
        Linked mentions ({backlinks.length})
        {isOrphan && (
          <span className="text-faint" style={{ textTransform: 'none', fontWeight: 400 }}>
            {' '}
            — orphaned note (no incoming links)
          </span>
        )}
      </div>
      {backlinks.map(({ meta, link }, i) => (
        <button
          key={`${meta.path}-${i}`}
          className="backlink-card"
          onClick={() => openNote(meta.path)}
        >
          <div className="backlink-title">{meta.title}</div>
          <div className="backlink-context">
            {contexts.get(`${meta.path}:${link.offset}`) ?? `[[${link.raw}]]`}
          </div>
        </button>
      ))}

      <div className="sidebar-section-label">Outgoing links ({outgoing.length})</div>
      {outgoing.map(({ link, resolved }, i) => (
        <button
          key={i}
          className="tag-row"
          onClick={() => void openNoteByTarget(resolved ?? link.target)}
        >
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}
          >
            {resolved ? <Link2 size={13} aria-hidden /> : <Link2Off size={13} aria-hidden />}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {link.alias ?? link.target}
            </span>
          </span>
          {!resolved && <span className="tag-count">broken</span>}
        </button>
      ))}

      {broken.length > 0 && (
        <p className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
          {broken.length} broken link{broken.length > 1 ? 's' : ''} — click to create the missing
          note.
        </p>
      )}

      <div className="sidebar-section-label">Unlinked mentions ({mentions.length})</div>
      {mentions.map((mention) => (
        <button key={mention.path} className="backlink-card" onClick={() => openNote(mention.path)}>
          <div className="backlink-title">{mention.title}</div>
          {mention.snippets[0] && (
            <div className="backlink-context">{mention.snippets[0].text}</div>
          )}
        </button>
      ))}
      {mentions.length === 0 && (
        <p className="text-small text-faint" style={{ padding: '0 var(--space-2)' }}>
          <Unlink size={12} aria-hidden /> No unlinked mentions found.
        </p>
      )}
    </div>
  )
}

export function BacklinksPanel() {
  const path = useActiveNotePath()
  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">Backlinks</span>
      </div>
      <div className="sidebar-body">
        {path ? (
          <BacklinksContent path={path} />
        ) : (
          <p className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
            Open a note to see its backlinks.
          </p>
        )}
      </div>
    </>
  )
}
