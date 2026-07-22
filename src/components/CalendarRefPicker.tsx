// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Insert a wiki-link reference to a calendar date or an event, from the slash
 * menu / command palette. Dates link to the day's journal; events link to
 * their page. Inserted via the shared `neoma:insert-text` editor hook.
 */
import { useMemo, useState } from 'react'
import { CalendarDays, CircleDot } from 'lucide-react'
import { Modal } from './Modal'
import { useUi } from '@/app/uiStore'
import { useVault } from '@/app/vaultStore'
import { isoDate } from '@/utils/dates'
import type { NoteMeta } from '@/types'

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

export function CalendarRefPicker() {
  const open = useUi((s) => s.calendarRefOpen)
  const metaVersion = useVault((s) => s.metaVersion)
  const [date, setDate] = useState(() => isoDate())
  const [query, setQuery] = useState('')

  const events = useMemo(() => {
    void metaVersion
    const q = query.toLowerCase().trim()
    return [...useVault.getState().metas.values()]
      .filter((m: NoteMeta) => {
        const type = str(m.frontmatter.type)
        return (type === 'event' || type === 'exam') && (!q || m.title.toLowerCase().includes(q))
      })
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 40)
  }, [metaVersion, query])

  if (!open) return null

  const insert = (text: string) => {
    window.dispatchEvent(new CustomEvent('neoma:insert-text', { detail: { text } }))
    useUi.getState().setCalendarRefOpen(false)
  }

  return (
    <Modal title="Reference a date or event" onClose={() => useUi.getState().setCalendarRefOpen(false)}>
      <div className="calref">
        <div className="calref-row">
          <input
            className="input"
            type="date"
            value={date}
            aria-label="Date to reference"
            onChange={(e) => setDate(e.target.value)}
          />
          <button className="btn btn-primary" disabled={!date} onClick={() => insert(`[[${date}]]`)}>
            <CalendarDays size={14} aria-hidden /> Insert date link
          </button>
        </div>

        <div className="sidebar-section-label">Events</div>
        <input
          className="input"
          type="search"
          placeholder="Find an event…"
          aria-label="Find an event"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ marginBottom: 'var(--space-2)' }}
        />
        <div className="calref-events">
          {events.length === 0 && (
            <p className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
              No events yet. Create one from the calendar (click a day), then reference it here.
            </p>
          )}
          {events.map((m) => (
            <button
              key={m.path}
              className="study-link"
              title={m.title}
              onClick={() => insert(`[[${m.title}]]`)}
            >
              <CircleDot
                size={12}
                aria-hidden
                style={{ color: str(m.frontmatter.type) === 'exam' ? '#e5484d' : '#30a46c' }}
              />
              <span className="study-link-name">{m.title}</span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}
