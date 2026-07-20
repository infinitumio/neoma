// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Daily journal panel: calendar date picker, previous/next navigation and
 * "open today". Notes are created only after explicit confirmation.
 */
import { useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { addDays, formatDate, isoDate } from '@/utils/dates'
import { dailyNoteExists, dailyNotePath, createDailyNote } from '@/templates/dailyNotes'
import { useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { useUi } from '@/app/uiStore'

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
      <div className="sidebar-header">
        <span className="sidebar-title">Daily journal</span>
      </div>
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

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
          <button className="btn" onClick={() => void openDaily(addDays(new Date(), -1))}>
            <ChevronLeft size={14} aria-hidden /> Yesterday
          </button>
          <button className="btn btn-primary" onClick={() => void openDaily(new Date())}>
            <CalendarDays size={14} aria-hidden /> Today
          </button>
          <button className="btn" onClick={() => void openDaily(addDays(new Date(), 1))}>
            Tomorrow <ChevronRight size={14} aria-hidden />
          </button>
        </div>
        <p className="text-small text-faint" style={{ marginTop: 'var(--space-3)' }}>
          Folder, date format and template are configurable in Settings → Daily notes.
        </p>
      </div>
    </>
  )
}
