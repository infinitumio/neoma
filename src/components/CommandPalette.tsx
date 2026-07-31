// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Command palette (Mod+K): searchable commands, plus a quick-open mode for
 * notes (Mod+O or typing after "Open note…"). Fully keyboard accessible.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Command as CommandIcon, FileText } from 'lucide-react'
import { useUi } from '@/app/uiStore'
import { useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { useCommandRegistry, listCommands } from '@/commands/registry'
import { effectiveBinding } from '@/commands/shortcuts'
import { formatShortcut } from '@/utils/misc'

interface Item {
  id: string
  label: string
  category?: string
  shortcut?: string
  run: () => void
}

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen)
  const mode = useUi((s) => s.paletteMode)
  const closePalette = useUi((s) => s.closePalette)
  useCommandRegistry((s) => s.version)
  const metas = useVault((s) => s.metas)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open, mode])

  const items = useMemo<Item[]>(() => {
    if (!open) return []
    const q = query.toLowerCase().trim()
    if (mode === 'notes') {
      return [...metas.values()]
        .filter(
          (meta) =>
            !q ||
            meta.title.toLowerCase().includes(q) ||
            meta.path.toLowerCase().includes(q) ||
            meta.aliases.some((a) => a.toLowerCase().includes(q)),
        )
        .sort((a, b) => b.modifiedAt - a.modifiedAt)
        .slice(0, 40)
        .map((meta) => ({
          id: meta.path,
          label: meta.title,
          category: meta.path,
          run: () => useTabs.getState().openNote(meta.path),
        }))
    }
    return listCommands()
      .filter(
        (command) =>
          !q ||
          command.title.toLowerCase().includes(q) ||
          (command.category ?? '').toLowerCase().includes(q),
      )
      .map((command) => ({
        id: command.id,
        label: command.title,
        category: command.category,
        shortcut: effectiveBinding(command.id, command.shortcut),
        run: () => void command.run(),
      }))
  }, [open, mode, query, metas])

  useEffect(() => {
    setSelected(0)
  }, [query])

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (!open) return null

  const activate = (item: Item) => {
    closePalette()
    item.run()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') closePalette()
    else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((s) => Math.min(s + 1, items.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((s) => Math.max(s - 1, 0))
    } else if (event.key === 'Enter' && items[selected]) {
      event.preventDefault()
      activate(items[selected])
    }
  }

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closePalette()
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <input
          ref={inputRef}
          className="palette-input"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-listbox"
          aria-activedescendant={items[selected] ? `palette-item-${selected}` : undefined}
          placeholder={mode === 'notes' ? 'Open note…' : 'Type a command…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <ul className="palette-list" role="listbox" id="palette-listbox" ref={listRef}>
          {items.length === 0 && <li className="palette-empty">No matches</li>}
          {items.map((item, index) => (
            <li
              key={item.id}
              id={`palette-item-${index}`}
              data-index={index}
              role="option"
              aria-selected={index === selected}
              className="palette-item"
              onMouseEnter={() => setSelected(index)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => activate(item)}
            >
              {mode === 'notes' ? (
                <FileText size={14} aria-hidden />
              ) : (
                <CommandIcon size={14} aria-hidden />
              )}
              <span className="palette-label">{item.label}</span>
              {item.category && <span className="palette-category">{item.category}</span>}
              {item.shortcut && <span className="kbd">{formatShortcut(item.shortcut)}</span>}
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
