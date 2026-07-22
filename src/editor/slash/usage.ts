// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Recents, frequency and favourites for slash commands, persisted locally.
 * Drives the Recent / Favourites groups and the ranking. A small version
 * counter lets React re-render when these change.
 */
const RECENTS_KEY = 'neoma.slash.recents'
const USAGE_KEY = 'neoma.slash.usage'
const FAVS_KEY = 'neoma.slash.favourites'
const MAX_RECENTS = 8

type Listener = () => void
const listeners = new Set<Listener>()
let version = 0

export function subscribeUsage(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export function usageVersion(): number {
  return version
}
function notify(): void {
  version++
  listeners.forEach((l) => l())
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function getRecents(): string[] {
  return read<string[]>(RECENTS_KEY, [])
}
export function getUsageCounts(): Record<string, number> {
  return read<Record<string, number>>(USAGE_KEY, {})
}
export function getFavourites(): string[] {
  return read<string[]>(FAVS_KEY, [])
}
export function isFavourite(id: string): boolean {
  return getFavourites().includes(id)
}

/** Record that a command was used (updates recents + frequency). */
export function recordUsage(id: string): void {
  const recents = [id, ...getRecents().filter((r) => r !== id)].slice(0, MAX_RECENTS)
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents))
  const usage = getUsageCounts()
  usage[id] = (usage[id] ?? 0) + 1
  localStorage.setItem(USAGE_KEY, JSON.stringify(usage))
  notify()
}

/** Clear the recently-used list (favourites and usage counts are untouched). */
export function clearRecents(): void {
  localStorage.setItem(RECENTS_KEY, JSON.stringify([]))
  notify()
}

export function toggleFavourite(id: string): void {
  const favs = getFavourites()
  const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id]
  localStorage.setItem(FAVS_KEY, JSON.stringify(next))
  notify()
}
