// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Study workflow state: the flashcard review session and "study mode"
 * (a distraction-reduced reading/writing layout). All offline.
 */
import { create } from 'zustand'
import { getAdapter, useVault } from '@/app/vaultStore'
import { isMarkdown } from '@/utils/paths'
import { parseFlashcards, type Flashcard } from './flashcards'

interface StudyState {
  /** Non-null while a review session is open. */
  review: { title: string; cards: Flashcard[] } | null
  studyMode: boolean

  openReview: (title: string, cards: Flashcard[]) => void
  closeReview: () => void
  setStudyMode: (on: boolean) => void
  toggleStudyMode: () => void
}

export const useStudy = create<StudyState>((set) => ({
  review: null,
  studyMode: false,

  openReview: (title, cards) => set({ review: { title, cards } }),
  closeReview: () => set({ review: null }),
  setStudyMode: (on) => set({ studyMode: on }),
  toggleStudyMode: () => set((s) => ({ studyMode: !s.studyMode })),
}))

/** Collect cards from a single note's current content (or from disk). */
export async function cardsForNote(path: string): Promise<Flashcard[]> {
  const cached = useVault.getState().notes.get(path)?.content
  const text = cached ?? (await getAdapter()?.readText(path)) ?? ''
  return parseFlashcards(path, text)
}

/** Collect cards across every markdown note in the vault. */
export async function cardsForVault(): Promise<Flashcard[]> {
  const adapter = getAdapter()
  if (!adapter) return []
  const notes = useVault.getState().notes
  const paths = [...useVault.getState().entries.values()]
    .filter((e) => e.kind === 'file' && isMarkdown(e.path))
    .map((e) => e.path)
  const all: Flashcard[] = []
  for (const path of paths) {
    try {
      const text = notes.get(path)?.content ?? (await adapter.readText(path))
      all.push(...parseFlashcards(path, text))
    } catch {
      /* skip unreadable notes */
    }
  }
  return all
}
