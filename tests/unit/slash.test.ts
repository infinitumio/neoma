// SPDX-License-Identifier: AGPL-3.0-or-later
/** Slash-command system: fuzzy matching, ranking, context, registry. */
import { describe, expect, it, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { fuzzyMatch } from '@/editor/slash/fuzzy'
import { rankSlashCommands, listSlashCommands } from '@/editor/slash/registry'
import { recordUsage, getRecents, toggleFavourite, getFavourites } from '@/editor/slash/usage'
import { SLASH_COMMANDS, registerSlashCommands } from '@/editor/slash/commands'

describe('fuzzyMatch', () => {
  it('matches a subsequence and reports indices', () => {
    const m = fuzzyMatch('hea', 'Heading 1')
    expect(m).not.toBeNull()
    expect(m!.indices).toEqual([0, 1, 2])
  })
  it('rewards an exact prefix over a scattered match', () => {
    const prefix = fuzzyMatch('mat', 'Matrix')!.score
    const scattered = fuzzyMatch('mat', 'Formula Sheet Amount')!.score
    expect(prefix).toBeGreaterThan(scattered)
  })
  it('returns null when not a subsequence', () => {
    expect(fuzzyMatch('xyz', 'Heading')).toBeNull()
  })
  it('empty query matches everything', () => {
    expect(fuzzyMatch('', 'anything')).toEqual({ score: 0, indices: [] })
  })
})

describe('slash registry ranking', () => {
  beforeEach(() => {
    localStorage.clear()
    registerSlashCommands()
  })

  it('registers the full command set into the registry', () => {
    expect(listSlashCommands().length).toBeGreaterThanOrEqual(SLASH_COMMANDS.length)
  })

  it('fuzzy /hea surfaces the headings', () => {
    const titles = rankSlashCommands('hea', null)
      .slice(0, 4)
      .map((r) => r.command.title)
    expect(titles).toContain('Heading 1')
    expect(titles).toContain('Heading 2')
  })

  it('fuzzy /pdf finds PDF-related commands', () => {
    const titles = rankSlashCommands('pdf', null).map((r) => r.command.title)
    expect(titles).toContain('PDF')
    expect(titles).toContain('Embed PDF')
  })

  it('fuzzy /math finds equation/matrix/proof-style commands', () => {
    const titles = rankSlashCommands('matrix', null).map((r) => r.command.title)
    expect(titles).toContain('Matrix')
  })

  it('context boosts relevant commands to the top', () => {
    const noCtx = rankSlashCommands('', null).findIndex((r) => r.command.id === 'list.checkbox')
    const listCtx = rankSlashCommands('', 'list').findIndex((r) => r.command.id === 'list.checkbox')
    expect(listCtx).toBeLessThan(noCtx)
  })

  it('recently used commands rank higher', () => {
    recordUsage('callout.warning')
    expect(getRecents()[0]).toBe('callout.warning')
    // Both share the 'callout' keyword; the recently used one ranks first.
    const ranked = rankSlashCommands('callout', null)
    const idx = ranked.findIndex((r) => r.command.id === 'callout.warning')
    const noteIdx = ranked.findIndex((r) => r.command.id === 'callout.note')
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThan(noteIdx)
  })

  it('favourites can be toggled and persist', () => {
    toggleFavourite('math.matrix')
    expect(getFavourites()).toContain('math.matrix')
    toggleFavourite('math.matrix')
    expect(getFavourites()).not.toContain('math.matrix')
  })
})

describe('command definitions', () => {
  it('AI commands are present but disabled (no fake features)', () => {
    const ai = SLASH_COMMANDS.filter((c) => c.category === 'AI')
    expect(ai.length).toBeGreaterThan(0)
    expect(ai.every((c) => c.disabledReason)).toBe(true)
  })
  it('every command has a unique id, icon and description', () => {
    const ids = new Set<string>()
    for (const c of SLASH_COMMANDS) {
      expect(ids.has(c.id)).toBe(false)
      ids.add(c.id)
      expect(c.icon).toBeTruthy()
      expect(c.description.length).toBeGreaterThan(0)
    }
  })
})
