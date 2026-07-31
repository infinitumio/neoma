// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Full-text search panel. All searching happens locally in the index worker.
 * Simple visible controls (broad / exact word / exact phrase, case, scope)
 * cover most needs; the advanced mini-syntax ("…", -term, tag:, path:,
 * type:) stays available for power users.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search as SearchIcon, CheckCircle2 } from 'lucide-react'
import type { SearchFilters, SearchResultItem } from '@/types'
import { getSearch, useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { debounce } from '@/utils/misc'
import { formatDate } from '@/utils/dates'

type SearchMode = 'broad' | 'word' | 'phrase'

interface SearchResponse {
  items: SearchResultItem[]
  stats: { checked: number; matched: number }
}

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
  const [mode, setMode] = useState<SearchMode>('broad')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [scopeFolder, setScopeFolder] = useState('')
  const [createdAfter, setCreatedAfter] = useState('')
  const [modifiedAfter, setModifiedAfter] = useState('')
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const metaVersion = useVault((s) => s.metaVersion)
  const entries = useVault((s) => s.entries)
  const openNote = useTabs((s) => s.openNote)

  const folders = useMemo(
    () =>
      [...entries.values()]
        .filter((e) => e.kind === 'folder')
        .map((e) => e.path)
        .sort(),
    [entries],
  )

  const runSearch = useCallback(
    async (
      q: string,
      opts: {
        mode: SearchMode
        caseSensitive: boolean
        folder: string
        created: string
        modified: string
      },
    ) => {
      const search = getSearch()
      if (!search || !q.trim()) {
        setResponse(null)
        return
      }
      setBusy(true)
      const filters: SearchFilters & { mode: SearchMode; caseSensitive: boolean } = {
        mode: opts.mode,
        caseSensitive: opts.caseSensitive,
      }
      if (opts.folder) filters.folder = opts.folder
      if (opts.created) filters.createdAfter = new Date(opts.created).getTime()
      if (opts.modified) filters.modifiedAfter = new Date(opts.modified).getTime()
      try {
        setResponse(await search.queryWithStats(q, filters))
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const debouncedSearch = useRef(
    debounce(
      (
        q: string,
        opts: {
          mode: SearchMode
          caseSensitive: boolean
          folder: string
          created: string
          modified: string
        },
      ) => void runSearch(q, opts),
      200,
    ),
  ).current

  useEffect(() => {
    debouncedSearch(query, {
      mode,
      caseSensitive,
      folder: scopeFolder,
      created: createdAfter,
      modified: modifiedAfter,
    })
  }, [
    query,
    mode,
    caseSensitive,
    scopeFolder,
    createdAfter,
    modifiedAfter,
    debouncedSearch,
    metaVersion,
  ])

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

  const items = response?.items ?? []

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">Search</span>
      </div>
      <div className="sidebar-body search-panel">
        <input
          ref={inputRef}
          className="input"
          type="search"
          role="searchbox"
          placeholder="Search your pages…"
          aria-label="Search vault"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="search-modes" role="group" aria-label="Search mode">
          {(
            [
              ['broad', 'Broad'],
              ['word', 'Exact word'],
              ['phrase', 'Exact phrase'],
            ] as Array<[SearchMode, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              className={`mode-chip${mode === id ? ' active' : ''}`}
              aria-pressed={mode === id}
              title={
                id === 'broad'
                  ? 'Ranked search with partial-word matches'
                  : id === 'word'
                    ? 'Match whole words only'
                    : 'Match the exact phrase'
              }
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="search-filters">
          <label
            className="text-small text-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />
            Case sensitive
          </label>
          <select
            className="input"
            style={{ width: 'auto' }}
            value={scopeFolder}
            aria-label="Search scope"
            onChange={(e) => setScopeFolder(e.target.value)}
          >
            <option value="">Entire vault</option>
            {folders.map((folder) => (
              <option key={folder} value={folder}>
                {folder}/
              </option>
            ))}
          </select>
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

        {response !== null && !busy && (
          <p className="search-status" role="status">
            <CheckCircle2 size={13} aria-hidden /> Search completed —{' '}
            <strong>
              {response.stats.matched} match{response.stats.matched === 1 ? '' : 'es'}
            </strong>{' '}
            in {response.stats.checked} page{response.stats.checked === 1 ? '' : 's'} checked
          </p>
        )}
        {busy && (
          <p className="search-status" role="status">
            Searching…
          </p>
        )}

        {response !== null && (
          <div aria-label="Search results">
            {items.length === 0 && (
              <p className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
                No matching pages. Try Broad mode, or check the scope filter.
              </p>
            )}
            {items.map((result) => (
              <button
                key={result.path}
                className="search-result"
                onClick={() => openNote(result.path)}
              >
                <div className="result-title">{result.title}</div>
                <div className="text-small text-faint">
                  {result.folder ? `${result.folder} · ` : ''}
                  {result.modifiedAt
                    ? `edited ${formatDate(new Date(result.modifiedAt), 'DD MMM YYYY')}`
                    : ''}
                </div>
                {result.snippets.map((snippet, i) => (
                  <Highlighted key={i} snippet={snippet} />
                ))}
              </button>
            ))}
          </div>
        )}

        {response === null && (
          <div className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <SearchIcon size={14} aria-hidden /> Search titles, contents, paths and tags — all on
              this device.
            </p>
            <p style={{ marginTop: 'var(--space-2)' }}>
              Optional advanced syntax: <code>"phrases"</code>, <code>-excluded</code>,{' '}
              <code>tag:</code>, <code>path:</code>, <code>type:</code>.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
