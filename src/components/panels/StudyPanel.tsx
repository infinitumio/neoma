// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Study dashboard: upcoming exams (from `type: exam` frontmatter) with a
 * days-until countdown, quick flashcard review, recent lecture PDFs and
 * recently edited notes. Everything is derived locally from the vault.
 */
import { useEffect, useMemo, useState } from 'react'
import { GraduationCap, FileText, Layers, Clock, Plus, BookOpen } from 'lucide-react'
import { useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { useStudy, cardsForVault } from '@/study/studyStore'
import { createNoteFromTemplate } from './TemplatesPanel'
import { getRecentPdfs } from '@/utils/recentPdfs'
import { basename } from '@/utils/paths'
import { isoDate } from '@/utils/dates'
import type { NoteMeta } from '@/types'

interface ExamRow {
  path: string
  title: string
  course?: string
  date?: string
  days: number | null
}

function daysUntil(date: string | undefined): number | null {
  if (!date) return null
  const target = new Date(date)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date(isoDate())
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

export function StudyPanel() {
  const metaVersion = useVault((s) => s.metaVersion)
  const vaultId = useVault((s) => s.vault?.id)
  const openNote = useTabs((s) => s.openNote)
  const openPdf = useTabs((s) => s.openPdf)
  const [cardCount, setCardCount] = useState<number | null>(null)

  const exams = useMemo<ExamRow[]>(() => {
    void metaVersion
    const metas = [...useVault.getState().metas.values()] as NoteMeta[]
    return metas
      .filter((m) => str(m.frontmatter.type) === 'exam')
      .map((m) => {
        const date = str(m.frontmatter['exam-date'])
        return {
          path: m.path,
          title: m.title,
          course: str(m.frontmatter.course),
          date,
          days: daysUntil(date),
        }
      })
      .sort((a, b) => {
        if (a.days === null) return 1
        if (b.days === null) return -1
        return a.days - b.days
      })
  }, [metaVersion])

  const recentNotes = useMemo(() => {
    void metaVersion
    return [...useVault.getState().metas.values()]
      .sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0))
      .slice(0, 6)
  }, [metaVersion])

  const recentPdfs = useMemo(() => {
    void metaVersion
    return getRecentPdfs(vaultId).filter((p) => useVault.getState().entries.has(p))
  }, [metaVersion, vaultId])

  // Count flashcards across the vault (async; refreshes on vault change).
  useEffect(() => {
    let cancelled = false
    void cardsForVault().then((cards) => {
      if (!cancelled) setCardCount(cards.length)
    })
    return () => {
      cancelled = true
    }
  }, [metaVersion])

  const reviewAll = async () => {
    const cards = await cardsForVault()
    if (cards.length) useStudy.getState().openReview('All flashcards', cards)
  }

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">Study</span>
        <button
          className="icon-btn"
          aria-label="New exam page"
          title="New exam page"
          onClick={() => void createNoteFromTemplate('exam-prep')}
        >
          <Plus size={16} aria-hidden />
        </button>
      </div>
      <div className="sidebar-body study-panel">
        <div className="study-actions">
          <button
            className="btn btn-primary"
            onClick={() => void reviewAll()}
            disabled={!cardCount}
          >
            <Layers size={14} aria-hidden /> Review flashcards
            {cardCount != null && cardCount > 0 && <span className="study-badge">{cardCount}</span>}
          </button>
          <button className="btn" onClick={() => useStudy.getState().toggleStudyMode()}>
            <BookOpen size={14} aria-hidden /> Study mode
          </button>
        </div>

        <div className="sidebar-section-label">
          <GraduationCap size={13} aria-hidden /> Upcoming exams
        </div>
        {exams.length === 0 && (
          <p className="text-small text-faint study-hint">
            Create an exam page (＋ above) to track dates, topics and revision.
          </p>
        )}
        {exams.map((exam) => (
          <button key={exam.path} className="study-exam" onClick={() => openNote(exam.path)}>
            <span className="study-exam-main">
              <span className="study-exam-title">{exam.title}</span>
              {exam.course && <span className="study-exam-sub">{exam.course}</span>}
            </span>
            {exam.days != null && (
              <span
                className={`study-days${exam.days < 0 ? ' past' : exam.days <= 7 ? ' soon' : ''}`}
              >
                {exam.days < 0
                  ? 'past'
                  : exam.days === 0
                    ? 'today'
                    : exam.days === 1
                      ? '1 day'
                      : `${exam.days} days`}
              </span>
            )}
          </button>
        ))}

        {recentPdfs.length > 0 && (
          <>
            <div className="sidebar-section-label">
              <FileText size={13} aria-hidden /> Recent lecture PDFs
            </div>
            {recentPdfs.map((path) => (
              <button
                key={path}
                className="study-link"
                title={basename(path)}
                onClick={() => openPdf(path)}
              >
                <FileText size={13} aria-hidden />
                <span className="study-link-name">{basename(path)}</span>
              </button>
            ))}
          </>
        )}

        <div className="sidebar-section-label">
          <Clock size={13} aria-hidden /> Recent notes
        </div>
        {recentNotes.map((note) => (
          <button
            key={note.path}
            className="study-link"
            title={note.title}
            onClick={() => openNote(note.path)}
          >
            <FileText size={13} aria-hidden />
            <span className="study-link-name">{note.title}</span>
          </button>
        ))}
      </div>
    </>
  )
}
