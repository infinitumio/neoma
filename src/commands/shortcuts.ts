// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Shortcut registry: maps key bindings like "Mod+K" to command ids.
 * Users can override any binding via Settings → Keyboard shortcuts
 * (stored in ApplicationSettings.customShortcuts as commandId → binding).
 */
import { listCommands, runCommand } from './registry'
import { useSettings } from '@/settings/settingsStore'

export interface ParsedBinding {
  key: string
  mod: boolean
  shift: boolean
  alt: boolean
}

export function parseBinding(binding: string): ParsedBinding | null {
  const parts = binding.split('+').map((p) => p.trim())
  const key = parts[parts.length - 1]
  if (!key) return null
  return {
    key: key.length === 1 ? key.toLowerCase() : key,
    mod: parts.includes('Mod'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
  }
}

const PUNCTUATION_CODES: Record<string, string> = {
  Backslash: '\\',
  Slash: '/',
  Comma: ',',
  Period: '.',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
  Backquote: '`',
}

/** The unshifted key a physical key code stands for, e.g. KeyN → n. */
function keyFromCode(code: string | undefined): string | null {
  if (!code) return null
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase()
  if (/^Digit\d$/.test(code)) return code.slice(5)
  return PUNCTUATION_CODES[code] ?? null
}

export function eventMatches(event: KeyboardEvent, binding: string): boolean {
  const parsed = parseBinding(binding)
  if (!parsed) return false
  if (
    (event.metaKey || event.ctrlKey) !== parsed.mod ||
    event.shiftKey !== parsed.shift ||
    event.altKey !== parsed.alt
  ) {
    return false
  }
  const eventKey = event.key.length === 1 ? event.key.toLowerCase() : event.key
  if (eventKey === parsed.key) return true
  // Shift and Option/Alt change the character a key types (Shift+\ is "|",
  // Option+N on a Mac is a dead key), so fall back to the physical key there.
  return (event.shiftKey || event.altKey) && keyFromCode(event.code) === parsed.key
}

/** The effective binding for a command (custom override or default). */
export function effectiveBinding(commandId: string, defaultBinding?: string): string | undefined {
  const custom = useSettings.getState().settings.customShortcuts[commandId]
  return custom ?? defaultBinding
}

/** Global keydown handler. Returns true when a command consumed the event. */
export function handleGlobalKeydown(event: KeyboardEvent): boolean {
  // Never intercept plain typing; commands use modifiers or function keys (F1).
  const functionKey = /^F\d{1,2}$/.test(event.key)
  if (!event.metaKey && !event.ctrlKey && !event.altKey && !functionKey) return false
  for (const command of listCommands()) {
    const binding = effectiveBinding(command.id, command.shortcut)
    if (!binding) continue
    if (eventMatches(event, binding)) {
      event.preventDefault()
      runCommand(command.id)
      return true
    }
  }
  return false
}
