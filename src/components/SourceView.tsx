// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Read-only Markdown source view: shows the exact `.md` file content —
 * frontmatter included — exactly as it is stored on disk. Useful for
 * copying, reviewing frontmatter, or confirming that a note is plain,
 * portable Markdown. This is a viewer, not an editor; edits happen in the
 * Edit or Split modes.
 */
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { useUi } from '@/app/uiStore'

interface SourceViewProps {
  content: string
}

export function SourceView({ content }: SourceViewProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      useUi.getState().toast('Could not copy to clipboard', 'error')
    }
  }

  const lineCount = content ? content.split('\n').length : 0

  return (
    <div className="source-view preview-pane" data-testid="source-view">
      <div className="source-toolbar">
        <span className="text-small text-faint">
          Markdown source · {lineCount} line{lineCount === 1 ? '' : 's'}
        </span>
        <button
          className="btn btn-ghost"
          onClick={() => void copy()}
          aria-label="Copy Markdown source"
        >
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="source-pre" tabIndex={0} aria-label="Markdown source">
        <code>{content || '​'}</code>
      </pre>
    </div>
  )
}
