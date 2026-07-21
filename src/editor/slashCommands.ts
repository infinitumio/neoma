// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Notion-style slash commands. Typing `/` on an empty line (or after
 * whitespace) opens a searchable menu of block inserts: text, academic,
 * media and organisation. Every entry inserts real, portable Markdown —
 * there are no placeholder commands. Works fully offline.
 */
import {
  snippet,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete'
import type { EditorView } from '@codemirror/view'
import { isoDate } from '@/utils/dates'
import { runCommand, getCommand } from '@/commands/registry'

interface SlashCommand {
  label: string
  description: string
  section: string
  keywords?: string
  /** snippet template (uses ${placeholder} fields) … */
  template?: string
  /** …or a custom apply for non-template behaviour */
  apply?: (view: EditorView, from: number, to: number) => void
}

const COMMANDS: SlashCommand[] = [
  // ---- Text ----
  { label: 'Text', description: 'Plain paragraph', section: 'Text', template: '${}' },
  {
    label: 'Heading 1',
    description: 'Large section heading',
    section: 'Text',
    template: '# ${Heading}',
  },
  {
    label: 'Heading 2',
    description: 'Medium section heading',
    section: 'Text',
    template: '## ${Heading}',
  },
  {
    label: 'Heading 3',
    description: 'Small section heading',
    section: 'Text',
    template: '### ${Heading}',
  },
  { label: 'Bulleted list', description: 'Simple list', section: 'Text', template: '- ${item}' },
  { label: 'Numbered list', description: 'Ordered list', section: 'Text', template: '1. ${item}' },
  {
    label: 'Task list',
    description: 'Checkboxes for to-dos',
    section: 'Text',
    template: '- [ ] ${task}',
  },
  {
    label: 'Toggle section',
    description: 'Collapsible section (click to fold)',
    section: 'Text',
    template: '> [!toggle]- ${Title}\n> ${content}',
  },
  { label: 'Quote', description: 'Blockquote', section: 'Text', template: '> ${quote}' },
  {
    label: 'Callout',
    description: 'Highlighted note box (note/tip/warning…)',
    section: 'Text',
    template: '> [!note] ${Title}\n> ${content}',
  },
  { label: 'Divider', description: 'Horizontal rule', section: 'Text', template: '---\n${}' },
  {
    label: 'Code block',
    description: 'Fenced code with syntax highlighting',
    section: 'Text',
    template: '```${language}\n${code}\n```',
  },
  {
    label: 'Highlight',
    description: 'Highlighted text',
    section: 'Text',
    template: '==${highlighted text}==',
  },

  // ---- Academic ----
  {
    label: 'Equation',
    description: 'Display equation (LaTeX, rendered offline)',
    section: 'Academic',
    keywords: 'math latex display',
    template: '$$\n${e = mc^2}\n$$',
  },
  {
    label: 'Inline equation',
    description: 'Maths inside a sentence',
    section: 'Academic',
    keywords: 'math latex',
    template: '$${x}$',
  },
  {
    label: 'Theorem',
    description: 'Theorem block',
    section: 'Academic',
    template: '> [!theorem] ${Name}\n> ${statement}',
  },
  {
    label: 'Definition',
    description: 'Definition block',
    section: 'Academic',
    template: '> [!definition] ${Term}\n> ${definition}',
  },
  {
    label: 'Worked example',
    description: 'Step-by-step example block',
    section: 'Academic',
    template: '> [!example] ${Problem}\n> ${solution steps}',
  },
  {
    label: 'Proof',
    description: 'Collapsible proof block',
    section: 'Academic',
    template: '> [!proof]- Proof\n> ${proof} $\\blacksquare$',
  },
  {
    label: 'Citation',
    description: 'Pandoc citation key (searchable)',
    section: 'Academic',
    keywords: 'reference bibtex',
    template: '[@${citekey}]',
  },
  {
    label: 'Footnote',
    description: 'Footnote reference + definition',
    section: 'Academic',
    template: '[^${1}]\n\n[^${1}]: ${footnote text}',
  },
  {
    label: 'Flashcard',
    description: 'Question/answer pair for revision',
    section: 'Academic',
    keywords: 'study revision',
    template: 'Question:: ${question}\nAnswer:: ${answer}',
  },
  {
    label: 'Exam question',
    description: 'Practice question with hidden answer',
    section: 'Academic',
    template: '**Q ${1}.** ${question} *(${marks} marks)*\n\n> [!toggle]- Answer\n> ${answer}',
  },
  {
    label: 'Lecture summary',
    description: 'Key concepts + own-words explanation sections',
    section: 'Academic',
    keywords: 'paraphrase study',
    template:
      '## Source material\n\n${referenced lecture content}\n\n## My explanation\n\n${the idea in my own words}\n\n## What I do not understand\n\n- ${open question}\n\n## Exam summary\n\n- ${condensed revision point}',
  },
  {
    label: 'Literature note section',
    description: 'Citation, findings, interpretation sections',
    section: 'Academic',
    template:
      '## Citation\n\n> ${authors, title, venue, year} [@${citekey}]\n\n## Main findings\n\n- ${finding}\n\n## Personal interpretation\n\n- ${interpretation}',
  },

  // ---- Media ----
  {
    label: 'Image',
    description: 'Embed an image (or paste/drag one directly)',
    section: 'Media',
    template: '![${alt text}](${Attachments/image.png})',
  },
  {
    label: 'PDF / file link',
    description: 'Link a file stored in the vault',
    section: 'Media',
    keywords: 'attachment document',
    template: '[${lecture.pdf}](${Attachments/lecture.pdf})',
  },
  {
    label: 'Table',
    description: 'Markdown table',
    section: 'Media',
    template:
      '| ${Column A} | ${Column B} |\n| ----------- | ----------- |\n| ${cell}     | ${cell}     |',
  },
  {
    label: 'Link to page',
    description: 'Wiki link with autocompletion',
    section: 'Media',
    apply: (view, from, to) => {
      view.dispatch({ changes: { from, to, insert: '[[' }, selection: { anchor: from + 2 } })
    },
  },
  {
    label: 'Link to heading',
    description: 'Link to a heading in a page',
    section: 'Media',
    template: '[[${Page}#${Heading}]]',
  },
  {
    label: 'Embed page',
    description: 'Embed another page or attachment',
    section: 'Media',
    apply: (view, from, to) => {
      view.dispatch({ changes: { from, to, insert: '![[' }, selection: { anchor: from + 3 } })
    },
  },

  // ---- Organisation ----
  {
    label: 'New subpage',
    description: 'Create a page inside this page',
    section: 'Organisation',
    apply: (view, from, to) => {
      view.dispatch({ changes: { from, to, insert: '' } })
      runCommand('page.new-subpage')
    },
  },
  {
    label: 'Properties',
    description: 'YAML frontmatter fields (type, course, due…)',
    section: 'Organisation',
    keywords: 'frontmatter metadata',
    template: '---\ntype: ${note}\ncourse: ${course}\ntags:\n  - ${tag}\n---\n${}',
  },
  {
    label: 'Date',
    description: "Insert today's date",
    section: 'Organisation',
    apply: (view, from, to) => {
      const date = isoDate()
      view.dispatch({
        changes: { from, to, insert: date },
        selection: { anchor: from + date.length },
      })
    },
  },
  {
    label: 'Study checklist',
    description: 'Revision checklist for a topic',
    section: 'Organisation',
    template:
      '## ${Topic} — revision checklist\n\n- [ ] Re-read lecture notes\n- [ ] Summarise in my own words\n- [ ] Work through examples\n- [ ] Practice questions\n- [ ] Review weak points\n',
  },
]

export function slashCommandCompletion(context: CompletionContext): CompletionResult | null {
  // Open on `/` at the start of a line or immediately after whitespace (so it
  // also works after a list marker like "1. "). Because a whitespace/start is
  // required just before the slash, mid-word slashes and URLs (`http://`)
  // never trigger it.
  const match = context.matchBefore(/(?:^|\s)\/([\w -]*)$/)
  if (!match) return null
  const slashOffset = match.text.indexOf('/')
  const from = match.from + slashOffset

  const options: Completion[] = COMMANDS.filter(
    (command) => !(command.label === 'New subpage' && !getCommand('page.new-subpage')),
  ).map((command) => ({
    label: command.label,
    detail: command.description,
    section: command.section,
    type: 'keyword',
    apply: (view, _completion, applyFrom, applyTo) => {
      const start = Math.min(from, applyFrom)
      if (command.apply) command.apply(view as EditorView, start, applyTo)
      else snippet(command.template ?? '')(view, _completion, start, applyTo)
    },
    boost: command.section === 'Text' ? 1 : 0,
  }))

  return {
    from: from + 1,
    options,
    validFor: /^[\w -]*$/,
  }
}
