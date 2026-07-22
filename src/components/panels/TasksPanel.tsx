// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Tasks panel: Today / Upcoming / Completed views over the vault's Markdown
 * checkboxes. Ticking a task writes straight back to the note. Tasks stay
 * readable Markdown — this is just a lens over them.
 */
import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Flag, GraduationCap, FileText } from 'lucide-react'
import { useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { tasksForVault, toggleTask } from '@/tasks/tasksStore'
import { daysFromToday, PRIORITY_RANK, type Task } from '@/tasks/tasks'
import { isoDate } from '@/utils/dates'

type View = 'today' | 'upcoming' | 'completed'

const PRIORITY_LABEL: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' }

function dueLabel(days: number | null): string | null {
  if (days === null) return null
  if (days < 0) return `${-days}d overdue`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `in ${days}d`
}

export function TasksPanel() {
  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">Tasks</span>
      </div>
      <TasksBody />
    </>
  )
}

/** Task list body without the panel header, so it can nest in the Planner. */
export function TasksBody() {
  const metaVersion = useVault((s) => s.metaVersion)
  const openNote = useTabs((s) => s.openNote)
  const [view, setView] = useState<View>('today')
  const [tasks, setTasks] = useState<Task[]>([])
  const today = isoDate()

  const refresh = () => void tasksForVault().then(setTasks)
  useEffect(() => {
    refresh()
  }, [metaVersion])

  const onToggle = async (task: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)))
    await toggleTask(task)
    refresh()
  }

  const counts = useMemo(() => {
    let todayN = 0
    let upcoming = 0
    let completed = 0
    for (const t of tasks) {
      if (t.done) {
        completed++
        continue
      }
      const d = daysFromToday(t.due, today)
      if (d !== null && d <= 0) todayN++
      else upcoming++
    }
    return { today: todayN, upcoming, completed }
  }, [tasks, today])

  const shown = useMemo(() => {
    const list = tasks.filter((t) => {
      if (view === 'completed') return t.done
      if (t.done) return false
      const d = daysFromToday(t.due, today)
      if (view === 'today') return d !== null && d <= 0
      return d === null || d > 0
    })
    return list.sort((a, b) => {
      const da = daysFromToday(a.due, today)
      const db = daysFromToday(b.due, today)
      if (da !== db) {
        if (da === null) return 1
        if (db === null) return -1
        return da - db
      }
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    })
  }, [tasks, view, today])

  return (
    <>
      <div className="sidebar-body">
        <div className="search-modes" role="tablist">
          {(['today', 'upcoming', 'completed'] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              className={`mode-chip${view === v ? ' active' : ''}`}
              onClick={() => setView(v)}
            >
              {v === 'today' ? 'Today' : v === 'upcoming' ? 'Upcoming' : 'Done'}
              <span className="task-count"> {counts[v]}</span>
            </button>
          ))}
        </div>

        {shown.length === 0 && (
          <p className="text-small text-faint" style={{ padding: 'var(--space-3) var(--space-2)' }}>
            {view === 'completed'
              ? 'No completed tasks yet.'
              : view === 'today'
                ? 'Nothing due today. 🎉'
                : 'No upcoming tasks. Add a `- [ ]` with 📅 a date.'}
          </p>
        )}

        <ul className="task-list">
          {shown.map((task) => {
            const days = daysFromToday(task.due, today)
            const dl = dueLabel(days)
            return (
              <li key={task.id} className={`task-row${task.done ? ' done' : ''}`}>
                <input
                  type="checkbox"
                  className="task-check"
                  checked={task.done}
                  aria-label={task.text}
                  onChange={() => void onToggle(task)}
                />
                <button className="task-main" onClick={() => openNote(task.path)}>
                  <span className="task-text">{task.text || '(untitled task)'}</span>
                  <span className="task-meta">
                    {dl && (
                      <span className={`task-badge${days !== null && days < 0 ? ' overdue' : ''}`}>
                        <CalendarClock size={11} aria-hidden /> {dl}
                      </span>
                    )}
                    {task.priority !== 'none' && (
                      <span className={`task-badge prio-${task.priority}`}>
                        <Flag size={11} aria-hidden /> {PRIORITY_LABEL[task.priority]}
                      </span>
                    )}
                    {task.course && (
                      <span className="task-badge">
                        <GraduationCap size={11} aria-hidden /> {task.course}
                      </span>
                    )}
                    <span className="task-badge subtle">
                      <FileText size={11} aria-hidden /> {task.pageName}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}
