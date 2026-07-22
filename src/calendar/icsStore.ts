// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Local, per-vault storage for imported .ics calendars. Read-only events from
 * an external calendar the user chose to import — kept in localStorage, never
 * fetched from the network here.
 */
import type { CalEvent } from './events'

function key(vaultId: string): string {
  return `neoma.ics.${vaultId}`
}

export function loadIcs(vaultId: string | null | undefined): CalEvent[] {
  if (!vaultId) return []
  try {
    const raw = localStorage.getItem(key(vaultId))
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? (list as CalEvent[]) : []
  } catch {
    return []
  }
}

export function saveIcs(vaultId: string | null | undefined, events: CalEvent[]): void {
  if (!vaultId) return
  try {
    localStorage.setItem(key(vaultId), JSON.stringify(events))
  } catch {
    /* storage full — non-fatal */
  }
}

export function clearIcs(vaultId: string | null | undefined): void {
  if (!vaultId) return
  try {
    localStorage.removeItem(key(vaultId))
  } catch {
    /* non-fatal */
  }
}
