// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Command registry. Every user-facing action registers here so it appears in
 * the command palette and can be bound to a shortcut. A future plugin API
 * registers commands through the same functions (documented in
 * docs/architecture.md § Registries).
 */
import { create } from 'zustand'
import type { Command } from '@/types'

interface CommandRegistryState {
  commands: Map<string, Command>
  version: number
}

export const useCommandRegistry = create<CommandRegistryState>(() => ({
  commands: new Map(),
  version: 0,
}))

export function registerCommand(command: Command): () => void {
  useCommandRegistry.setState((state) => {
    const commands = new Map(state.commands)
    commands.set(command.id, command)
    return { commands, version: state.version + 1 }
  })
  return () => unregisterCommand(command.id)
}

export function registerCommands(commands: Command[]): () => void {
  const disposers = commands.map(registerCommand)
  return () => disposers.forEach((dispose) => dispose())
}

export function unregisterCommand(id: string): void {
  useCommandRegistry.setState((state) => {
    const commands = new Map(state.commands)
    commands.delete(id)
    return { commands, version: state.version + 1 }
  })
}

export function getCommand(id: string): Command | undefined {
  return useCommandRegistry.getState().commands.get(id)
}

export function listCommands(): Command[] {
  return [...useCommandRegistry.getState().commands.values()].filter(
    (c) => !c.isAvailable || c.isAvailable(),
  )
}

export function runCommand(id: string): void {
  const command = getCommand(id)
  if (command && (!command.isAvailable || command.isAvailable())) void command.run()
}
