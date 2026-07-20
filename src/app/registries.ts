// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Panel and settings registries.
 *
 * Together with the command registry (src/commands/registry.ts) and the
 * markdown extension registry (src/markdown/registry.ts), these are the four
 * extension points a future plugin API builds on — documented in
 * docs/architecture.md § Registries. First-party features register here just
 * like a plugin would; no third-party code is executed in version 1.
 */
import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { SidePanelId } from './uiStore'

export interface PanelRegistration {
  id: SidePanelId
  label: string
  icon: LucideIcon
  component: ComponentType
  order: number
}

const panels = new Map<string, PanelRegistration>()

export function registerPanel(panel: PanelRegistration): void {
  panels.set(panel.id, panel)
}

export function listPanels(): PanelRegistration[] {
  return [...panels.values()].sort((a, b) => a.order - b.order)
}

export function getPanel(id: string): PanelRegistration | undefined {
  return panels.get(id)
}

export interface SettingsSectionRegistration {
  id: string
  label: string
  component: ComponentType
  order: number
}

const settingsSections = new Map<string, SettingsSectionRegistration>()

export function registerSettingsSection(section: SettingsSectionRegistration): void {
  settingsSections.set(section.id, section)
}

export function listSettingsSections(): SettingsSectionRegistration[] {
  return [...settingsSections.values()].sort((a, b) => a.order - b.order)
}
