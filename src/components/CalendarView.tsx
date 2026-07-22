// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Lightweight calendar: a month grid and an agenda list over events derived
 * from note frontmatter (`date`/`due`/`exam-date`) and task due dates. Events
 * link to their page; colours follow the course or event kind. Fully offline —
 * external calendars (ICS/Google/Outlook) are an optional future add-on.
 */
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, ListChecks, CircleDot } from 'lucide-react'
import { useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { tasksForVault } from '@/tasks/tasksStore'
import { eventsFromMetas, eventColor, type CalEvent } from '@/calendar/events'
import { addDays, formatDate, isoDate } from '@/utils/dates'
import type { NoteMeta } from '@/types'

type Mode = 'month' | 'agenda'

export default function CalendarView() {
  const metaVersion = useVault((s) => s.metaVersion)
  const openNote = useTabs((s) => s.openNote)
  const [viewDate, setViewDate] = useState(() => new Date())
  const [mode, setMode] = useState<Mode>('month')
  const [course, setCourse] = useState('')
  const [taskEvents, setTaskEvents] = useState<CalEvent[]>([])

  // Frontmatter events (sync) + task-due events (async).
  const noteEvents = useMemo(() => {
    void metaVersion
    return eventsFromMetas([...useVault.getState().metas.values()] as NoteMeta[])
  }, [metaVersion])

  useEffect(() => {
    let cancelled = false
    void tasksForVault().then((tasks) => {
      if (cancelled) return
      setTaskEvents(
        tasks
          .filter((t) => t.due && !t.done)
          .map((t) => ({
            date: t.due as string,
            title: t.text || '(task)',
            path: t.path,
            kind: 'task' as const,
            course: t.course,
            done: t.done,
            line: t.line,
          })),
      )
    })
    return () => {
      cancelled = true
    }
  }, [metaVersion])

  const allEvents = useMemo(() => [...noteEvents, ...taskEvents], [noteEvents, taskEvents])
  const courses = useMemo(() => {
    const set = new Set<string>()
    for (const e of allEvents) if (e.course) set.add(e.course)
    return [...set].sort()
  }, [allEvents])
  const events = useMemo(
    () => (course ? allEvents.filter((e) => e.course === course) : allEvents),
    [allEvents, course],
  )

  const byDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const e of events) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return map
  }, [events])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const today = isoDate()

  const days = useMemo(() => {
    const first = new Date(year, month, 1)
    const gridStart = addDays(first, -first.getDay())
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  }, [year, month])

  const openEvent = (e: CalEvent) => openNote(e.path)

  return (
    <div className="calendar-view" data-testid="calendar-view">
      <div className="calendar-view-toolbar">
        <button
          className="icon-btn"
          aria-label="Previous month"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
        <span className="calendar-view-title" aria-live="polite">
          {formatDate(viewDate, 'MMMM YYYY')}
        </span>
        <button
          className="icon-btn"
          aria-label="Next month"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
        <button className="btn btn-small" onClick={() => setViewDate(new Date())}>
          Today
        </button>
        <span className="pdf-toolbar-sep" />
        <button
          className={`icon-btn${mode === 'month' ? ' active' : ''}`}
          aria-label="Month view"
          aria-pressed={mode === 'month'}
          onClick={() => setMode('month')}
        >
          <CalendarDays size={16} aria-hidden />
        </button>
        <button
          className={`icon-btn${mode === 'agenda' ? ' active' : ''}`}
          aria-label="Agenda view"
          aria-pressed={mode === 'agenda'}
          onClick={() => setMode('agenda')}
        >
          <ListChecks size={16} aria-hidden />
        </button>
        <span style={{ flex: 1 }} />
        {courses.length > 0 && (
          <select
            className="input"
            style={{ width: 'auto' }}
            value={course}
            aria-label="Filter by course"
            onChange={(e) => setCourse(e.target.value)}
          >
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {mode === 'month' ? (
        <div className="calendar-month">
          <div className="calendar-month-dow">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="calendar-month-grid">
            {days.map((day) => {
              const iso = isoDate(day)
              const dayEvents = byDate.get(iso) ?? []
              return (
                <div
                  key={iso}
                  className={[
                    'calendar-cell',
                    day.getMonth() !== month ? 'other-month' : '',
                    iso === today ? 'today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span className="calendar-cell-num">{day.getDate()}</span>
                  <div className="calendar-cell-events">
                    {dayEvents.map((e, i) => (
                      <button
                        key={i}
                        className={`calendar-event${e.kind === 'task' ? ' is-task' : ''}`}
                        style={{ borderColor: eventColor(e) }}
                        title={`${e.title}${e.course ? ` · ${e.course}` : ''}`}
                        onClick={() => openEvent(e)}
                      >
                        <span className="calendar-event-dot" style={{ background: eventColor(e) }} />
                        <span className="calendar-event-title">{e.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <Agenda events={events} today={today} onOpen={openEvent} />
      )}
    </div>
  )
}

function Agenda({
  events,
  today,
  onOpen,
}: {
  events: CalEvent[]
  today: string
  onOpen: (e: CalEvent) => void
}) {
  const groups = useMemo(() => {
    const upcoming = events
      .filter((e) => e.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
    const map = new Map<string, CalEvent[]>()
    for (const e of upcoming) {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    }
    return [...map.entries()]
  }, [events, today])

  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <p>No upcoming events.</p>
        <p className="text-small text-faint">
          Add <code>date:</code>, <code>due:</code> or <code>exam-date:</code> to a page&rsquo;s
          frontmatter, or a task with 📅 a date.
        </p>
      </div>
    )
  }

  return (
    <div className="calendar-agenda">
      {groups.map(([date, list]) => (
        <div key={date} className="calendar-agenda-day">
          <div className="calendar-agenda-date">
            {formatDate(new Date(date), 'dddd, DD MMMM')}
            {date === today && <span className="calendar-agenda-today">Today</span>}
          </div>
          {list.map((e, i) => (
            <button key={i} className="calendar-agenda-event" onClick={() => onOpen(e)}>
              <CircleDot size={13} style={{ color: eventColor(e) }} aria-hidden />
              <span className="calendar-agenda-title">{e.title}</span>
              {e.course && <span className="task-badge">{e.course}</span>}
              <span className="task-badge subtle">{e.kind}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
