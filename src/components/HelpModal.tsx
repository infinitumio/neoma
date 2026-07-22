// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Help section: short, plain-language answers to the questions new users ask,
 * plus a keyboard-shortcut reference. Opened from the activity rail or the
 * command palette; always available offline.
 */
import { useState } from 'react'
import { Modal } from './Modal'
import { useUi } from '@/app/uiStore'
import { listCommands } from '@/commands/registry'
import { effectiveBinding } from '@/commands/shortcuts'
import { formatShortcut } from '@/utils/misc'

interface Topic {
  q: string
  a: React.ReactNode
}

const TOPICS: Topic[] = [
  {
    q: 'What is a vault?',
    a: 'A vault is the folder where neoma keeps a collection of related pages, attachments and settings. You can have several — for example one for your degree and one for personal notes. A vault lives on this device (in the browser, or in a real folder you pick) and is never uploaded.',
  },
  {
    q: 'How are my pages stored?',
    a: 'Every page is an ordinary Markdown (.md) file. A page with subpages is stored as a folder plus a matching file (e.g. Machine Learning/Machine Learning.md). Nothing is locked in a proprietary database, so your notes open in VS Code, Obsidian, or any text editor.',
  },
  {
    q: 'How does offline mode work?',
    a: 'After your first visit neoma caches itself, so it opens and works with no internet — creating, editing, searching, linking, maths, the graph, exports and settings all work offline. The status bar simply shows “Offline”; it is a normal state, not an error.',
  },
  {
    q: 'How do I create a subpage?',
    a: 'Right-click a page in the sidebar and choose “New subpage”, use the /New subpage slash command, or drag one page onto another to nest it. Breadcrumbs above the editor show where you are.',
  },
  {
    q: 'How do I link pages?',
    a: 'Type [[ and pick a page from the list. Use [[Page|Label]] for custom text, [[Page#Heading]] to target a heading, and ![[Page]] to embed one. The Backlinks panel shows every page that links to the current one.',
  },
  {
    q: 'How do I write mathematics?',
    a: 'Use $…$ for inline maths and $$…$$ for display equations (LaTeX, rendered offline by KaTeX). The Σ button in the page header inserts common symbols; double-click a rendered equation in Reading view to copy its LaTeX.',
  },
  {
    q: 'How do I highlight text?',
    a: 'Select text and use the floating toolbar’s highlighter to pick a colour, or type ==text== for the default yellow. Coloured highlights are saved as a documented, portable syntax.',
  },
  {
    q: 'How do I back up or move a vault?',
    a: 'Use the “…” menu in the Files panel → Export vault as ZIP for a full backup, or export a single page as Markdown/HTML. To move between devices, export and import, or use a local-folder vault with your own sync tool.',
  },
]

export function HelpModal() {
  const open = useUi((s) => s.helpOpen)
  const setOpen = useUi((s) => s.setHelpOpen)
  const [tab, setTab] = useState<'topics' | 'shortcuts'>('topics')
  if (!open) return null

  const bound = listCommands()
    .map((c) => ({ ...c, binding: effectiveBinding(c.id, c.shortcut) }))
    .filter((c) => c.binding)

  return (
    <Modal title="Help" onClose={() => setOpen(false)} wide>
      <div className="help-tabs" role="tablist" aria-label="Help sections">
        <button
          role="tab"
          aria-selected={tab === 'topics'}
          className={`mode-chip${tab === 'topics' ? ' active' : ''}`}
          onClick={() => setTab('topics')}
        >
          Getting started
        </button>
        <button
          role="tab"
          aria-selected={tab === 'shortcuts'}
          className={`mode-chip${tab === 'shortcuts' ? ' active' : ''}`}
          onClick={() => setTab('shortcuts')}
        >
          Keyboard shortcuts
        </button>
      </div>

      {tab === 'topics' ? (
        <div style={{ marginTop: 'var(--space-3)' }}>
          {TOPICS.map((topic) => (
            <details key={topic.q} className="help-topic">
              <summary>{topic.q}</summary>
              <p>{topic.a}</p>
            </details>
          ))}
        </div>
      ) : (
        <table className="props-table" style={{ marginTop: 'var(--space-3)' }}>
          <tbody>
            {bound.map((c) => (
              <tr key={c.id}>
                <th scope="row">{c.title}</th>
                <td>
                  <span className="kbd">{formatShortcut(c.binding!)}</span>
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row">Bold / Italic / Highlight</th>
              <td>
                <span className="kbd">{formatShortcut('Mod+B')}</span>{' '}
                <span className="kbd">{formatShortcut('Mod+I')}</span>{' '}
                <span className="kbd">{formatShortcut('Mod+Shift+H')}</span>
              </td>
            </tr>
            <tr>
              <th scope="row">Slash commands</th>
              <td>
                Type <span className="kbd">/</span> on a blank line
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </Modal>
  )
}
