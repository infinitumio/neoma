// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Daily journal panel: calendar date picker, previous/next navigation and
 * "open today". Notes are created only after explicit confirmation.
 */
import { useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, Plus, Trash2, ArrowUpRight } from 'lucide-react'
import { addDays, formatDate, isoDate } from '@/utils/dates'
import { dailyNoteExists, dailyNotePath, createDailyNote } from '@/templates/dailyNotes'
import { useVault, appendUnderHeading } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { useUi } from '@/app/uiStore'
import { getQuickNotes, addQuickNote, removeQuickNote } from '@/journal/quicknotes'

export async function openDaily(date: Date, confirmCreate = true): Promise<void> {
  const path = dailyNotePath(date)
  const tabs = useTabs.getState()
  if (useVault.getState().entries.has(path)) {
    tabs.openNote(path)
    return
  }
  const create = async () => {
    const created = await createDailyNote(date)
    if (created) tabs.openNote(created)
  }
  if (!confirmCreate) {
    await create()
    return
  }
  useUi.getState().askConfirm({
    title: 'Create daily note?',
    message: `No journal entry exists for ${isoDate(date)} yet. Create it from your daily template?`,
    confirmLabel: 'Create',
    onConfirm: create,
  })
}

export function DailyPanel() {
  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">Journal</span>
      </div>
      <JournalBody />
    </>
  )
}

/** Fast dated jottings for today, kept locally; promote one into the day's
 *  note when you want it permanent. */
function QuickNotes() {
  const vaultId = useVault((s) => s.vault?.id)
  const today = isoDate()
  const [text, setText] = useState('')
  const [version, setVersion] = useState(0)
  const notes = getQuickNotes(vaultId, today)

  const add = () => {
    if (!text.trim()) return
    addQuickNote(vaultId, today, text, Date.now())
    setText('')
    setVersion((v) => v + 1)
  }
  const remove = (id: string) => {
    removeQuickNote(vaultId, id)
    setVersion((v) => v + 1)
  }
  const promote = async (text: string, id: string) => {
    const created = await createDailyNote(new Date())
    const path = created ?? dailyNotePath(new Date())
    // Keep promoted quick notes together under one "Quick notes" heading.
    await appendUnderHeading(path, 'Quick notes', `- ${text}`)
    remove(id)
    useUi.getState().toast('Added under “Quick notes” in today’s journal', 'success')
  }
  void version

  return (
    <div className="quicknotes">
      <div className="sidebar-section-label">Quick notes · Today</div>
      <div className="quicknotes-input">
        <input
          className="input"
          placeholder="Jot something…"
          value={text}
          aria-label="Quick note"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <button className="icon-btn" aria-label="Add quick note" onClick={add} disabled={!text.trim()}>
          <Plus size={16} aria-hidden />
        </button>
      </div>
      {notes.length === 0 && (
        <p className="text-small text-faint" style={{ padding: '2px var(--space-2)' }}>
          Fast, private jottings for today. Promote one into your journal anytime.
        </p>
      )}
      <ul className="quicknotes-list">
        {notes.map((n) => (
          <li key={n.id} className="quicknote">
            <span className="quicknote-text">{n.text}</span>
            <button
              className="icon-btn quicknote-action"
              aria-label="Add to today's journal"
              title="Add to today's journal"
              onClick={() => void promote(n.text, n.id)}
            >
              <ArrowUpRight size={13} aria-hidden />
            </button>
            <button
              className="icon-btn quicknote-action"
              aria-label="Delete quick note"
              onClick={() => remove(n.id)}
            >
              <Trash2 size={13} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Journal calendar body without the panel header, for nesting in the Planner. */
export function JournalBody() {
  const [viewDate, setViewDate] = useState(() => new Date())
  useVault((s) => s.entries) // re-render when notes change

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay() // Sunday-first grid
  const gridStart = addDays(firstDay, -startOffset)
  const today = isoDate()
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  return (
    <>
      <div className="sidebar-body">
        <div className="calendar" role="application" aria-label="Daily note calendar">
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
              const exists = dailyNoteExists(day)
              return (
                <button
                  key={iso}
                  className={[
                    'calendar-day',
                    day.getMonth() !== month ? 'other-month' : '',
                    iso === today ? 'today' : '',
                    exists ? 'has-note' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => void openDaily(day)}
                  aria-label={`${iso}${exists ? ', has journal entry' : ''}${iso === today ? ', today' : ''}`}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        </div>

        <div className="daily-quicknav">
          <button
            className="btn daily-quicknav-arrow"
            title="Open yesterday's journal"
            aria-label="Open yesterday's journal"
            onClick={() => void openDaily(addDays(new Date(), -1))}
          >
            <ChevronLeft size={16} aria-hidden />
          </button>
          <button className="btn btn-primary daily-quicknav-today" onClick={() => void openDaily(new Date())}>
            <CalendarDays size={14} aria-hidden />
            <span>Today</span>
          </button>
          <button
            className="btn daily-quicknav-arrow"
            title="Open tomorrow's journal"
            aria-label="Open tomorrow's journal"
            onClick={() => void openDaily(addDays(new Date(), 1))}
          >
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
        <QuickNotes />
        <p className="text-small text-faint" style={{ marginTop: 'var(--space-3)' }}>
          Folder, date format and template are configurable in Settings → Daily notes.
        </p>
      </div>
    </>
  )
}
