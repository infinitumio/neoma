// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Template resolution and placeholder expansion. User templates are plain
 * notes inside the configured templates folder; built-ins are bundled.
 */
import type { Template } from '@/types'
import { BUILTIN_TEMPLATES } from './builtins'
import { formatDate, isoDate } from '@/utils/dates'
import { isMarkdown, isWithin, stem } from '@/utils/paths'
import { getAdapter, useVault } from '@/app/vaultStore'
import { useSettings } from '@/settings/settingsStore'

/** All templates available right now: built-ins + user template notes. */
export function listTemplates(): Template[] {
  const { templatesFolder } = useSettings.getState().settings
  const entries = useVault.getState().entries
  const userTemplates: Template[] = []
  for (const entry of entries.values()) {
    if (entry.kind !== 'file' || !isMarkdown(entry.path)) continue
    if (!isWithin(templatesFolder, entry.path)) continue
    userTemplates.push({
      id: `user:${entry.path}`,
      name: stem(entry.path),
      description: 'User template',
      content: '',
    })
  }
  userTemplates.sort((a, b) => a.name.localeCompare(b.name))
  return [...BUILTIN_TEMPLATES, ...userTemplates]
}

export async function getTemplateContent(id: string): Promise<string | null> {
  const builtin = BUILTIN_TEMPLATES.find((t) => t.id === id)
  if (builtin) return builtin.content
  if (id.startsWith('user:')) {
    const adapter = getAdapter()
    if (!adapter) return null
    try {
      return await adapter.readText(id.slice(5))
    } catch {
      return null
    }
  }
  return null
}

/** Expand {{title}}, {{date}}, {{time}} and {{date:FORMAT}} placeholders. */
export function expandTemplate(content: string, title: string, date: Date = new Date()): string {
  return content
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{date:([^}]+)\}\}/g, (_, format: string) => formatDate(date, format))
    .replace(/\{\{date\}\}/g, isoDate(date))
    .replace(/\{\{time\}\}/g, formatDate(date, 'HH:mm'))
}
