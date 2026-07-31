// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Templates panel: create a note from any template, or manage user
 * templates (plain notes inside the templates folder).
 */
import { LayoutTemplate, FilePlus2, FolderOpen } from 'lucide-react'
import { listTemplates, getTemplateContent, expandTemplate } from '@/templates/service'
import { createNote, createFolder, useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { useUi } from '@/app/uiStore'
import { useSettings } from '@/settings/settingsStore'

export async function createNoteFromTemplate(templateId: string, title?: string): Promise<void> {
  const ui = useUi.getState()
  const template = listTemplates().find((t) => t.id === templateId)
  if (!template) return
  ui.askPrompt({
    title: `New ${template.name}`,
    label: 'Note title',
    initial: title ?? '',
    placeholder: 'e.g. Experiment 02 - longer context',
    confirmLabel: 'Create',
    onSubmit: async (value) => {
      const name = value.trim() || template.name
      const content = await getTemplateContent(templateId)
      const path = await createNote('', name, expandTemplate(content ?? '', name))
      if (path) useTabs.getState().openNote(path)
    },
  })
}

export function TemplatesPanel() {
  useVault((s) => s.entries) // refresh when template notes change
  const templatesFolder = useSettings((s) => s.settings.templatesFolder)
  const templates = listTemplates()
  const builtIns = templates.filter((t) => t.builtIn)
  const userTemplates = templates.filter((t) => !t.builtIn)
  const openNote = useTabs((s) => s.openNote)

  const newUserTemplate = async () => {
    await createFolder('', templatesFolder).catch(() => {})
    const path = await createNote(
      templatesFolder,
      'My template',
      `---\ntitle: {{title}}\ncreated: {{date}}\n---\n\n## Section\n\n- \n`,
    )
    if (path) openNote(path)
  }

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">Templates</span>
        <button
          className="icon-btn"
          onClick={() => void newUserTemplate()}
          aria-label="New user template"
          title="New user template"
        >
          <FilePlus2 size={16} aria-hidden />
        </button>
      </div>
      <div className="sidebar-body">
        <div className="sidebar-section-label">Built-in</div>
        {builtIns.map((template) => (
          <button
            key={template.id}
            className="backlink-card"
            onClick={() => void createNoteFromTemplate(template.id)}
          >
            <div className="backlink-title">
              <LayoutTemplate size={13} aria-hidden style={{ marginRight: 6 }} />
              {template.name}
            </div>
            <div className="backlink-context">{template.description}</div>
          </button>
        ))}

        <div className="sidebar-section-label">Your templates ({templatesFolder}/)</div>
        {userTemplates.length === 0 && (
          <p className="text-small text-faint" style={{ padding: '0 var(--space-2)' }}>
            <FolderOpen size={12} aria-hidden /> Notes inside “{templatesFolder}” appear here.
            Placeholders: <code>{'{{title}}'}</code>, <code>{'{{date}}'}</code>,{' '}
            <code>{'{{time}}'}</code>, <code>{'{{date:YYYY-MM-DD}}'}</code>.
          </p>
        )}
        {userTemplates.map((template) => (
          <button
            key={template.id}
            className="backlink-card"
            onClick={() => void createNoteFromTemplate(template.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              openNote(template.id.slice(5))
            }}
            title="Click to use. Right-click to edit the template note."
          >
            <div className="backlink-title">{template.name}</div>
            <div className="backlink-context">Right-click to edit</div>
          </button>
        ))}
      </div>
    </>
  )
}
