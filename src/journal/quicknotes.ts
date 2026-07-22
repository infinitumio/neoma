// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Quick notes — tiny, dated jottings kept per vault in localStorage. They're
 * for fast capture from the Journal panel; promote one into the day's note
 * whenever you want something permanent. Offline, local only.
 */
export interface QuickNote {
  id: string
  date: string // ISO YYYY-MM-DD
  text: string
  at: number // epoch ms
}

function key(vaultId: string): string {
  return `neoma.quicknotes.${vaultId}`
}

function all(vaultId: string | null | undefined): QuickNote[] {
  if (!vaultId) return []
  try {
    const raw = localStorage.getItem(key(vaultId))
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? (list as QuickNote[]) : []
  } catch {
    return []
  }
}

function persist(vaultId: string, notes: QuickNote[]): void {
  try {
    localStorage.setItem(key(vaultId), JSON.stringify(notes))
  } catch {
    /* storage full — non-fatal */
  }
}

export function getQuickNotes(vaultId: string | null | undefined, date: string): QuickNote[] {
  return all(vaultId)
    .filter((n) => n.date === date)
    .sort((a, b) => b.at - a.at)
}

export function addQuickNote(
  vaultId: string | null | undefined,
  date: string,
  text: string,
  at: number,
): QuickNote | null {
  if (!vaultId || !text.trim()) return null
  const note: QuickNote = { id: `q${at}${Math.floor(at % 1000)}`, date, text: text.trim(), at }
  persist(vaultId, [...all(vaultId), note])
  return note
}

export function removeQuickNote(vaultId: string | null | undefined, id: string): void {
  if (!vaultId) return
  persist(
    vaultId,
    all(vaultId).filter((n) => n.id !== id),
  )
}
