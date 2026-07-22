// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Calendar sidebar panel — a mini month calendar of events (frontmatter + task
 * due dates + imported .ics), with a link to the full calendar. One of the
 * three panels in the rail's "Planner" group (alongside Journal and Tasks).
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, CircleDot, Plus } from 'lucide-react'
import { addDays, formatDate, isoDate } from '@/utils/dates'
import { useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { eventsFromMetas, eventColor, type CalEvent } from '@/calendar/events'
import { promptNewEvent } from '@/calendar/newEvent'
import { tasksForVault } from '@/tasks/tasksStore'
import { loadIcs } from '@/calendar/icsStore'
import type { NoteMeta } from '@/types'

export function CalendarPanel() {
  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">Calendar</span>
      </div>
      <EventsBody />
    </>
  )
}

/** Mini month calendar of events (frontmatter + tasks + imported), plus a link
 *  to the full calendar. */
function EventsBody() {
  const metaVersion = useVault((s) => s.metaVersion)
  const vaultId = useVault((s) => s.vault?.id)
  const openNote = useTabs((s) => s.openNote)
  const openSpecial = useTabs((s) => s.openSpecial)
  const [viewDate, setViewDate] = useState(() => new Date())
  const [dynamic, setDynamic] = useState<CalEvent[]>([])
  const [selected, setSelected] = useState(() => isoDate())

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const today = isoDate()

  useEffect(() => {
    let cancelled = false
    void tasksForVault().then((tasks) => {
      if (cancelled) return
      const taskEvents: CalEvent[] = tasks
        .filter((t) => t.due && !t.done)
        .map((t) => ({ date: t.due as string, title: t.text, path: t.path, kind: 'task' as const }))
      setDynamic([...taskEvents, ...loadIcs(vaultId)])
    })
    return () => {
      cancelled = true
    }
  }, [metaVersion, vaultId])

  const eventsByDate = useMemo(() => {
    void metaVersion
    const notes = eventsFromMetas([...useVault.getState().metas.values()] as NoteMeta[])
    const map = new Map<string, CalEvent[]>()
    for (const e of [...notes, ...dynamic]) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return map
  }, [metaVersion, dynamic])

  const days = useMemo(() => {
    const first = new Date(year, month, 1)
    return Array.from({ length: 42 }, (_, i) => addDays(first, -first.getDay() + i))
  }, [year, month])

  const upcoming = useMemo(
    () =>
      [...eventsByDate.entries()]
        .filter(([d]) => d >= today)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .flatMap(([, list]) => list)
        .slice(0, 8),
    [eventsByDate, today],
  )

  return (
    <div className="sidebar-body">
      <button
        className="btn btn-small"
        style={{ width: '100%', justifyContent: 'center', marginBottom: 'var(--space-2)' }}
        onClick={() => openSpecial('calendar')}
      >
        <Maximize2 size={13} aria-hidden /> Open full calendar
      </button>
      <div className="calendar" role="application" aria-label="Calendar">
        <div className="calendar-header">
          <button
            className="icon-btn"
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <span aria-live="polite">{formatDate(viewDate, 'MMMM YYYY')}</span>
          <button
            className="icon-btn"
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
        <div className="calendar-grid">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <span key={d} className="dow" aria-hidden>
              {d}
            </span>
          ))}
          {days.map((day) => {
            const iso = isoDate(day)
            const dayEvents = eventsByDate.get(iso) ?? []
            return (
              <button
                key={iso}
                className={[
                  'calendar-day',
                  day.getMonth() !== month ? 'other-month' : '',
                  iso === today ? 'today' : '',
                  iso === selected ? 'selected' : '',
                  dayEvents.length ? 'has-note' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                title={dayEvents.map((e) => e.title).join('\n') || undefined}
                onClick={() => setSelected(iso)}
                aria-label={iso}
                style={
                  dayEvents.length
                    ? ({ '--dot-color': eventColor(dayEvents[0]) } as React.CSSProperties)
                    : undefined
                }
              >
                {day.getDate()}
              </button>
            )
          })}
        </div>
      </div>

      <div className="calendar-panel-daybar">
        <span className="sidebar-section-label" style={{ padding: 0 }}>
          {formatDate(new Date(selected), 'ddd, DD MMM')}
        </span>
        <button
          className="btn btn-small"
          onClick={() => promptNewEvent(selected)}
          title="Add an event on this day"
        >
          <Plus size={13} aria-hidden /> Event
        </button>
      </div>
      {(eventsByDate.get(selected) ?? []).length === 0 ? (
        <p className="text-small text-faint" style={{ padding: '0 var(--space-2)' }}>
          Nothing on this day. Add an event, or pick another date.
        </p>
      ) : (
        (eventsByDate.get(selected) ?? []).map((e, i) => (
          <button
            key={i}
            className="study-link"
            title={e.title}
            onClick={() => e.path && openNote(e.path)}
          >
            <CircleDot size={12} style={{ color: eventColor(e) }} aria-hidden />
            <span className="study-link-name">{e.title}</span>
          </button>
        ))
      )}

      <div className="sidebar-section-label">Upcoming</div>
      {upcoming.length === 0 && (
        <p className="text-small text-faint" style={{ padding: '0 var(--space-2)' }}>
          No upcoming events. Add a <code>date:</code> to a page, or import a calendar in Settings.
        </p>
      )}
      {upcoming.map((e, i) => (
        <button
          key={i}
          className="study-link"
          title={e.title}
          onClick={() => e.path && openNote(e.path)}
        >
          <CircleDot size={12} style={{ color: eventColor(e) }} aria-hidden />
          <span className="study-link-name">
            {formatDate(new Date(e.date), 'DD MMM')} · {e.title}
          </span>
        </button>
      ))}
    </div>
  )
}
