// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Full-text search panel. All searching happens locally in the index worker.
 * Supports phrases ("…"), exclusions (-term), tag:/path:/type: filters and
 * date filters.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import type { SearchFilters, SearchResultItem } from '@/types'
import { getSearch, useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { debounce } from '@/utils/misc'

function Highlighted({ snippet }: { snippet: SearchResultItem['snippets'][number] }) {
  const parts: React.ReactNode[] = []
  let cursor = 0
  snippet.ranges.forEach(([start, end], i) => {
    if (start > cursor) parts.push(snippet.text.slice(cursor, start))
    parts.push(<mark key={i}>{snippet.text.slice(start, end)}</mark>)
    cursor = end
  })
  if (cursor < snippet.text.length) parts.push(snippet.text.slice(cursor))
  return <div className="result-snippet">{parts}</div>
}

export function SearchPanel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [createdAfter, setCreatedAfter] = useState('')
  const [modifiedAfter, setModifiedAfter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const metaVersion = useVault((s) => s.metaVersion)
  const openNote = useTabs((s) => s.openNote)

  const runSearch = useCallback(async (q: string, created: string, modified: string) => {
    const search = getSearch()
    if (!search || !q.trim()) {
      setResults(null)
      return
    }
    setBusy(true)
    const filters: SearchFilters = {}
    if (created) filters.createdAfter = new Date(created).getTime()
    if (modified) filters.modifiedAfter = new Date(modified).getTime()
    try {
      setResults(await search.query(q, filters))
    } finally {
      setBusy(false)
    }
  }, [])

  const debouncedSearch = useRef(
    debounce((q: string, c: string, m: string) => void runSearch(q, c, m), 200),
  ).current

  useEffect(() => {
    debouncedSearch(query, createdAfter, modifiedAfter)
  }, [query, createdAfter, modifiedAfter, debouncedSearch, metaVersion])

  // Allow other components (tag clicks) to drive the search box.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      setQuery(detail)
      inputRef.current?.focus()
    }
    window.addEventListener('neoma:search', handler)
    return () => window.removeEventListener('neoma:search', handler)
  }, [])

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">Search</span>
      </div>
      <div className="sidebar-body">
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            className="input"
            type="search"
            role="searchbox"
            placeholder='e.g. attention "exact phrase" -draft tag:experiments'
            aria-label="Search vault"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="search-filters">
          <label className="text-small text-secondary">
            Created after{' '}
            <input
              className="input"
              type="date"
              value={createdAfter}
              onChange={(e) => setCreatedAfter(e.target.value)}
              aria-label="Filter: created after date"
            />
          </label>
          <label className="text-small text-secondary">
            Modified after{' '}
            <input
              className="input"
              type="date"
              value={modifiedAfter}
              onChange={(e) => setModifiedAfter(e.target.value)}
              aria-label="Filter: modified after date"
            />
          </label>
        </div>
        <div role="status" className="visually-hidden">
          {busy ? 'Searching' : results ? `${results.length} results` : ''}
        </div>
        {results !== null && (
          <div aria-label="Search results">
            {results.length === 0 && (
              <p className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
                No matching notes.
              </p>
            )}
            {results.map((result) => (
              <button
                key={result.path}
                className="search-result"
                onClick={() => openNote(result.path)}
              >
                <div className="result-title">{result.title}</div>
                <div className="text-small text-faint">{result.path}</div>
                {result.snippets.map((snippet, i) => (
                  <Highlighted key={i} snippet={snippet} />
                ))}
              </button>
            ))}
          </div>
        )}
        {results === null && (
          <div className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <SearchIcon size={14} aria-hidden /> Search titles, contents, paths and tags.
            </p>
            <p style={{ marginTop: 'var(--space-2)' }}>
              Use <code>"phrases"</code>, <code>-excluded</code>, <code>tag:</code>,{' '}
              <code>path:</code> and <code>type:</code>.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
