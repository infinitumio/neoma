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

/**
 * Insert `line` at the end of the `## <heading>` section, creating the section
 * at the end of the document if it doesn't exist. Keeps promoted quick notes
 * together under one heading in the day's note (instead of scattering them).
 */
export function insertUnderHeading(content: string, heading: string, line: string): string {
  const lines = content.split('\n')
  const re = new RegExp(`^#{1,6}\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i')
  const headingIdx = lines.findIndex((l) => re.test(l))
  if (headingIdx === -1) {
    return `${content.replace(/\n+$/, '')}\n\n## ${heading}\n\n${line}\n`
  }
  // End of the section = the next heading of any level, or the document end.
  let end = lines.length
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i])) {
      end = i
      break
    }
  }
  // Insert after the last non-empty line within the section.
  let insertAt = headingIdx
  for (let i = headingIdx + 1; i < end; i++) if (lines[i].trim() !== '') insertAt = i
  lines.splice(insertAt + 1, 0, line)
  return lines.join('\n')
}
