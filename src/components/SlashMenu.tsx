// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The slash-command menu overlay. Renders directly beneath the cursor from
 * the shared slash registry: fuzzy-ranked, grouped by category (with
 * Favourites/Recent when idle), with a rich preview (icon, title,
 * description, shortcut, example) and full keyboard/screen-reader support.
 * All rendering here; keyboard handling lives in the CodeMirror keymap.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Star, RotateCcw } from 'lucide-react'
import { useSlashMenu } from '@/editor/slash/store'
import { rankSlashCommands, getSlashCommand } from '@/editor/slash/registry'
import {
  getFavourites,
  getRecents,
  isFavourite,
  toggleFavourite,
  clearRecents,
  subscribeUsage,
  usageVersion,
} from '@/editor/slash/usage'
import type { SlashCategory, SlashCommand } from '@/editor/slash/types'
import { CATEGORY_ORDER } from '@/editor/slash/types'
import { slashIconSvg } from '@/editor/slashIcons'
import { formatShortcut } from '@/utils/misc'
import { useIsMobile } from '@/hooks/useMediaQuery'

interface Group {
  category: SlashCategory
  commands: Array<{ command: SlashCommand; indices: number[] }>
}

/** Group ranked commands into ordered category sections. Empty query shows
 *  Favourites and Recent first. */
function buildGroups(query: string, context: Parameters<typeof rankSlashCommands>[1]): Group[] {
  const ranked = rankSlashCommands(query, context)
  const flat = ranked.map((r) => ({ command: r.command, indices: r.indices }))

  const groups: Group[] = []
  if (!query.trim()) {
    const favIds = new Set(getFavourites())
    const favs = getFavourites()
      .map((id) => getSlashCommand(id))
      .filter((c): c is SlashCommand => !!c)
      .map((command) => ({ command, indices: [] }))
    if (favs.length) groups.push({ category: 'Favourites', commands: favs })

    const recents = getRecents()
      .map((id) => getSlashCommand(id))
      .filter((c): c is SlashCommand => !!c && !favIds.has(c.id))
      .slice(0, 6)
      .map((command) => ({ command, indices: [] }))
    if (recents.length) groups.push({ category: 'Recent', commands: recents })
  }

  const byCategory = new Map<SlashCategory, Group['commands']>()
  for (const item of flat) {
    const list = byCategory.get(item.command.category) ?? []
    list.push(item)
    byCategory.set(item.command.category, list)
  }
  for (const category of CATEGORY_ORDER) {
    if (category === 'Favourites' || category === 'Recent') continue
    const commands = byCategory.get(category)
    if (commands?.length) groups.push({ category, commands })
  }
  return groups
}

function Highlighted({ text, indices }: { text: string; indices: number[] }) {
  if (!indices.length) return <>{text}</>
  const set = new Set(indices)
  return (
    <>
      {[...text].map((ch, i) =>
        set.has(i) ? (
          <mark key={i} className="slash-hl">
            {ch}
          </mark>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </>
  )
}

export function SlashMenu() {
  const open = useSlashMenu((s) => s.open)
  const query = useSlashMenu((s) => s.query)
  const context = useSlashMenu((s) => s.context)
  const coords = useSlashMenu((s) => s.coords)
  const selectedIndex = useSlashMenu((s) => s.selectedIndex)
  const setIndex = useSlashMenu((s) => s.setIndex)
  // Re-render when favourites/recents change.
  useSyncExternalStore(subscribeUsage, usageVersion)

  const listRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  // On phones the menu is a bottom sheet that sits above the on-screen
  // keyboard (tracked via visualViewport), not a cursor-anchored popup.
  const isMobile = useIsMobile()
  const [sheetBottom, setSheetBottom] = useState(0)

  const groups = useMemo(() => buildGroups(query, context), [query, context])
  // Flatten to map selectedIndex → command (matches rankSlashCommands order).
  const flatCommands = useMemo(
    () => rankSlashCommands(query, context).map((r) => r.command),
    [query, context],
  )
  // For empty query, the flat ranked order is what keyboard nav uses; the
  // Favourites/Recent groups are duplicates shown first for discovery.

  // Position the menu beneath the cursor, flipping up if it would overflow.
  // (Desktop only — the mobile sheet is anchored to the bottom.)
  useLayoutEffect(() => {
    if (!open || isMobile || !coords) return
    const width = 420
    const maxHeight = 460
    let left = coords.left
    let top = coords.bottom + 6
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8
    if (top + maxHeight > window.innerHeight - 8) top = Math.max(8, coords.top - maxHeight - 6)
    setPos({ left: Math.max(8, left), top })
  }, [open, coords, isMobile])

  // Keep the mobile sheet just above the on-screen keyboard.
  useEffect(() => {
    if (!open || !isMobile) return
    const vv = window.visualViewport
    const update = () =>
      setSheetBottom(vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0)
    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
    }
  }, [open, isMobile])

  // Keep the selected row in view.
  useEffect(() => {
    if (!open) return
    listRef.current
      ?.querySelector(`[data-cmd-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex, open])

  if (!open) return null
  if (!isMobile && !pos) return null

  const selectedCommand = flatCommands[selectedIndex]
  const indexOf = (id: string) => flatCommands.findIndex((c) => c.id === id)

  return createPortal(
    <div
      className={`slash-menu${isMobile ? ' slash-menu-sheet' : ''}`}
      style={isMobile ? { bottom: sheetBottom } : { left: pos!.left, top: pos!.top }}
      role="listbox"
      aria-label="Slash commands"
      // Never steal focus from the editor.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="slash-list" ref={listRef}>
        {groups.length === 0 && <div className="slash-empty">No matching commands</div>}
        {groups.map((group) => (
          <div key={group.category} className="slash-group">
            <div className="slash-group-label">
              <span>{group.category}</span>
              {group.category === 'Recent' && (
                <button
                  className="slash-group-clear"
                  aria-label="Clear recent commands"
                  title="Clear recent"
                  // Keep focus in the editor; clear on mousedown before blur.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    clearRecents()
                  }}
                >
                  <RotateCcw size={12} aria-hidden />
                </button>
              )}
            </div>
            {group.commands.map((item) => {
              const flatIndex = indexOf(item.command.id)
              const selected = flatIndex === selectedIndex && flatIndex !== -1
              const disabled = !!item.command.disabledReason
              return (
                <div
                  key={`${group.category}:${item.command.id}`}
                  data-cmd-index={selected ? selectedIndex : undefined}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={disabled}
                  className={`slash-item${selected ? ' selected' : ''}${disabled ? ' disabled' : ''}`}
                  title={item.command.disabledReason}
                  onMouseEnter={() => flatIndex !== -1 && setIndex(flatIndex)}
                  onClick={() => !disabled && useSlashMenu.getState().acceptId(item.command.id)}
                >
                  <span
                    className="slash-item-icon"
                    aria-hidden
                    dangerouslySetInnerHTML={{ __html: slashIconSvg(item.command.icon) }}
                  />
                  <span className="slash-item-body">
                    <span className="slash-item-title">
                      <Highlighted text={item.command.title} indices={item.indices} />
                    </span>
                    <span className="slash-item-desc">
                      {disabled ? item.command.disabledReason : item.command.description}
                    </span>
                  </span>
                  {item.command.shortcut && (
                    <span className="kbd slash-item-shortcut">
                      {formatShortcut(item.command.shortcut)}
                    </span>
                  )}
                  <button
                    className={`slash-fav${isFavourite(item.command.id) ? ' on' : ''}`}
                    aria-label={
                      isFavourite(item.command.id) ? 'Unpin command' : 'Pin command to favourites'
                    }
                    aria-pressed={isFavourite(item.command.id)}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavourite(item.command.id)
                    }}
                  >
                    <Star size={13} aria-hidden />
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {selectedCommand && (
        <div className="slash-preview" aria-hidden>
          <div className="slash-preview-head">
            <span
              className="slash-item-icon"
              dangerouslySetInnerHTML={{ __html: slashIconSvg(selectedCommand.icon) }}
            />
            <span>
              <span className="slash-preview-title">{selectedCommand.title}</span>
              <span className="slash-preview-cat">{selectedCommand.category}</span>
            </span>
          </div>
          <p className="slash-preview-desc">
            {selectedCommand.disabledReason ?? selectedCommand.description}
          </p>
          {selectedCommand.example && (
            <pre className="slash-preview-example">
              <code>{selectedCommand.example}</code>
            </pre>
          )}
          <div className="slash-preview-hint text-faint text-small">
            <span className="kbd">↵</span> insert · <span className="kbd">Tab</span> insert ·{' '}
            <span className="kbd">Esc</span> close · <span className="kbd">★</span> pin
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
