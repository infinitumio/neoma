// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Central slash-command registry. Every insertable command registers here,
 * and the same definitions surface in the global command palette (see
 * commands.ts → registerSlashCommands). Plugins can add commands through
 * `registerSlashCommand` without touching the menu.
 */
import type { EditorContext, SlashCommand } from './types'
import { fuzzyMatch } from './fuzzy'
import { getRecents, getUsageCounts, getFavourites } from './usage'

const registry = new Map<string, SlashCommand>()

export function registerSlashCommand(command: SlashCommand): () => void {
  registry.set(command.id, command)
  return () => registry.delete(command.id)
}

export function listSlashCommands(): SlashCommand[] {
  return [...registry.values()]
}

export function getSlashCommand(id: string): SlashCommand | undefined {
  return registry.get(id)
}

export interface RankedCommand {
  command: SlashCommand
  indices: number[]
}

/**
 * Rank commands for a query + context. Ranking order (per the spec):
 * exact/fuzzy match strength → recently used → frequently used → context
 * boost → alphabetical. Favourites and recents are surfaced as their own
 * groups for an empty query.
 */
export function rankSlashCommands(query: string, context: EditorContext): RankedCommand[] {
  const q = query.trim()
  const recents = getRecents()
  const usage = getUsageCounts()
  const recentRank = new Map(recents.map((id, i) => [id, recents.length - i]))

  const scored: Array<{ command: SlashCommand; indices: number[]; score: number }> = []
  for (const command of registry.values()) {
    const haystack = [command.title, ...(command.keywords ?? [])]
    let best: { score: number; indices: number[] } | null = null
    for (const text of haystack) {
      const m = fuzzyMatch(q, text)
      if (m && (!best || m.score > best.score)) {
        // Only the title's indices are meaningful for highlighting.
        best = { score: m.score, indices: text === command.title ? m.indices : [] }
      }
    }
    if (!best) continue

    let score = best.score
    score += (recentRank.get(command.id) ?? 0) * 4
    score += Math.min(usage[command.id] ?? 0, 20) * 2
    if (context && command.contexts?.includes(context)) score += 60
    scored.push({ command, indices: best.indices, score })
  }

  scored.sort((a, b) => b.score - a.score || a.command.title.localeCompare(b.command.title))
  return scored.map(({ command, indices }) => ({ command, indices }))
}

/** Whether an empty query should show the Favourites/Recent groups. */
export function hasFavouritesOrRecents(): boolean {
  return getFavourites().length > 0 || getRecents().length > 0
}
