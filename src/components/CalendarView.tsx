// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Lightweight calendar: a month grid and an agenda list over events derived
 * from note frontmatter (`date`/`due`/`exam-date`), task due dates and any
 * imported .ics calendars (imported from Settings). Selecting a day shows a
 * summary of everything on it — events, the journal entry, and notes edited
 * that day. Events link to their page. Fully offline.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ListChecks,
  CircleDot,
  BookOpen,
  FileClock,
  GraduationCap,
  CheckSquare,
  CalendarClock,
  Link2,
  Plus,
  X,
} from 'lucide-react'
import { useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { eventsFromMetas, eventColor, type CalEvent, type EventKind } from '@/calendar/events'
import { promptNewEvent } from '@/calendar/newEvent'
import { tasksForVault } from '@/tasks/tasksStore'
import { loadIcs } from '@/calendar/icsStore'
import { dailyNotePath, dailyNoteExists } from '@/templates/dailyNotes'
import { openDaily } from './panels/DailyPanel'
import { addDays, formatDate, isoDate } from '@/utils/dates'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useSheetDrag } from '@/hooks/useSheetDrag'
import type { NoteMeta } from '@/types'

type Mode = 'month' | 'agenda'

const KIND_ICON: Record<EventKind, typeof CalendarDays> = {
  exam: GraduationCap,
  task: CheckSquare,
  ics: CalendarClock,
  note: CalendarDays,
}
const KIND_COLOR: Record<EventKind, string> = {
  exam: '#e5484d',
  task: '#4c8dff',
  ics: '#8e6ee6',
  note: '#30a46c',
}

/** Distinct event kinds present on a day, for the little day-cell icons. */
function distinctKinds(events: CalEvent[]): EventKind[] {
  const order: EventKind[] = ['exam', 'task', 'note', 'ics']
  const present = new Set(events.map((e) => e.kind))
  return order.filter((k) => present.has(k))
}

export default function CalendarView() {
  const metaVersion = useVault((s) => s.metaVersion)
  const vaultId = useVault((s) => s.vault?.id)
  const openNote = useTabs((s) => s.openNote)
  const isMobile = useIsMobile()
  const [viewDate, setViewDate] = useState(() => new Date())
  const [mode, setMode] = useState<Mode>('month')
  const [course, setCourse] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [taskEvents, setTaskEvents] = useState<CalEvent[]>([])
  const [icsEvents, setIcsEvents] = useState<CalEvent[]>([])

  useEffect(() => setIcsEvents(loadIcs(vaultId)), [vaultId, metaVersion])

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
          })),
      )
    })
    return () => {
      cancelled = true
    }
  }, [metaVersion])

  const allEvents = useMemo(
    () => [...noteEvents, ...taskEvents, ...icsEvents],
    [noteEvents, taskEvents, icsEvents],
  )
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

  // Dates that other notes reference by a wiki link (e.g. [[2026-07-25]] or
  // [[Journal/2026-07-25]]) — shown with a small link marker on the day.
  const referencedDates = useMemo(() => {
    void metaVersion
    const set = new Set<string>()
    for (const meta of useVault.getState().metas.values()) {
      for (const link of meta.links) {
        const m = /(\d{4}-\d{2}-\d{2})/.exec(link.target)
        if (m) set.add(m[1])
      }
    }
    return set
  }, [metaVersion])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const today = isoDate()

  const days = useMemo(() => {
    const first = new Date(year, month, 1)
    const gridStart = addDays(first, -first.getDay())
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  }, [year, month])

  const openEvent = (e: CalEvent) => {
    if (e.path) openNote(e.path)
  }

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
        <button
          className="btn btn-small"
          onClick={() => {
            setViewDate(new Date())
            setSelected(today)
          }}
        >
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
        <div className="calendar-month-wrap">
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
                const hasJournal = dailyNoteExists(day)
                return (
                  <button
                    key={iso}
                    type="button"
                    className={[
                      'calendar-cell',
                      day.getMonth() !== month ? 'other-month' : '',
                      iso === today ? 'today' : '',
                      iso === selected ? 'selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    title={overview(dayEvents, hasJournal)}
                    onClick={() => setSelected(iso)}
                  >
                    <span className="calendar-cell-top">
                      <span className="calendar-cell-icons" aria-hidden>
                        {hasJournal && (
                          <BookOpen size={11} style={{ color: 'var(--color-accent)' }} />
                        )}
                        {distinctKinds(dayEvents).map((k) => {
                          const Icon = KIND_ICON[k]
                          return <Icon key={k} size={11} style={{ color: KIND_COLOR[k] }} />
                        })}
                        {referencedDates.has(iso) && (
                          <Link2 size={11} style={{ color: 'var(--color-text-faint)' }} />
                        )}
                      </span>
                      <span className="calendar-cell-num">{day.getDate()}</span>
                    </span>
                    <div className="calendar-cell-events">
                      {dayEvents.slice(0, 4).map((e, i) => (
                        <span
                          key={i}
                          className={`calendar-event${e.kind === 'task' ? ' is-task' : ''}`}
                          style={{ borderColor: eventColor(e) }}
                          role="button"
                          tabIndex={-1}
                          onClick={(ev) => {
                            ev.stopPropagation()
                            openEvent(e)
                          }}
                        >
                          <span
                            className="calendar-event-dot"
                            style={{ background: eventColor(e) }}
                          />
                          <span className="calendar-event-title">{e.title}</span>
                        </span>
                      ))}
                      {dayEvents.length > 4 && (
                        <span className="calendar-more">+{dayEvents.length - 4} more</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          {selected && (
            <>
              {isMobile && (
                <button
                  className="drawer-backdrop"
                  aria-label="Close day"
                  onClick={() => setSelected(null)}
                />
              )}
              <DaySummary
                date={selected}
                events={byDate.get(selected) ?? []}
                onOpen={openEvent}
                onClose={() => setSelected(null)}
                mobile={isMobile}
              />
            </>
          )}
        </div>
      ) : (
        <Agenda events={events} today={today} onOpen={openEvent} />
      )}
    </div>
  )
}

/** Native-tooltip text summarising a day on hover. */
function overview(events: CalEvent[], hasJournal: boolean): string | undefined {
  const parts: string[] = []
  if (hasJournal) parts.push('📓 Journal entry')
  for (const e of events) parts.push(`• ${e.title}`)
  return parts.length ? parts.join('\n') : undefined
}

/** Everything on a selected day: events, the journal entry, notes edited. */
function DaySummary({
  date,
  events,
  onOpen,
  onClose,
  mobile,
}: {
  date: string
  events: CalEvent[]
  onOpen: (e: CalEvent) => void
  onClose: () => void
  mobile?: boolean
}) {
  const metaVersion = useVault((s) => s.metaVersion)
  const openNote = useTabs((s) => s.openNote)
  const drag = useSheetDrag<HTMLElement>({
    onClose,
    direction: 'down',
    enabled: !!mobile,
  })
  const day = new Date(date)

  const journalPath = dailyNotePath(day)
  const hasJournal = dailyNoteExists(day)

  const editedNotes = useMemo(() => {
    void metaVersion
    return [...useVault.getState().metas.values()]
      .filter((m) => isoDate(new Date(m.modifiedAt)) === date && m.path !== journalPath)
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
      .slice(0, 12)
  }, [metaVersion, date, journalPath])

  const empty = events.length === 0 && !hasJournal && editedNotes.length === 0

  return (
    <aside
      ref={mobile ? drag.ref : undefined}
      className={`calendar-summary${mobile ? ' calendar-summary-sheet' : ''}`}
      aria-label={`Summary for ${date}`}
    >
      {mobile && (
        <div
          className="sheet-grabber"
          onTouchStart={drag.onTouchStart}
          onTouchMove={drag.onTouchMove}
          onTouchEnd={drag.onTouchEnd}
        >
          <div className="more-sheet-handle" aria-hidden />
        </div>
      )}
      <div className="calendar-summary-head">
        <span>{formatDate(day, 'dddd, DD MMMM YYYY')}</span>
        <button className="icon-btn" aria-label="Close day summary" onClick={onClose}>
          <X size={15} aria-hidden />
        </button>
      </div>

      <button
        className="btn btn-small"
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={() => promptNewEvent(date)}
      >
        <Plus size={13} aria-hidden /> New event
      </button>

      {empty && (
        <p className="text-small text-faint" style={{ marginTop: 'var(--space-3)' }}>
          Nothing else recorded on this day.
        </p>
      )}

      {events.length > 0 && (
        <section>
          <div className="sidebar-section-label">Events</div>
          {events.map((e, i) => (
            <button key={i} className="study-link" title={e.title} onClick={() => onOpen(e)}>
              <CircleDot size={12} style={{ color: eventColor(e) }} aria-hidden />
              <span className="study-link-name">{e.title}</span>
            </button>
          ))}
        </section>
      )}

      <section>
        <div className="sidebar-section-label">Journal</div>
        <button className="study-link" onClick={() => void openDaily(day)}>
          <BookOpen size={12} aria-hidden />
          <span className="study-link-name">
            {hasJournal ? 'Open journal entry' : 'Create journal entry'}
          </span>
        </button>
      </section>

      {editedNotes.length > 0 && (
        <section>
          <div className="sidebar-section-label">Notes edited</div>
          {editedNotes.map((m) => (
            <button
              key={m.path}
              className="study-link"
              title={m.path}
              onClick={() => openNote(m.path)}
            >
              <FileClock size={12} aria-hidden />
              <span className="study-link-name">{m.title}</span>
            </button>
          ))}
        </section>
      )}
    </aside>
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
