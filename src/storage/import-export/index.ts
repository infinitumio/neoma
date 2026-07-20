// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Portable import/export. ZIP exports preserve the vault's folder hierarchy
 * and attachment paths exactly, so an exported vault can be re-imported, put
 * under Git, or opened directly in any other Markdown application.
 */
import { zip, unzip, strToU8, strFromU8, type Zippable } from 'fflate'
import type { StorageAdapter } from '@/types'
import { isMarkdown, normalizePath, stem } from '@/utils/paths'

function zipAsync(data: Zippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(data, { level: 6 }, (err, result) => (err ? reject(err) : resolve(result)))
  })
}

function unzipAsync(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(data, (err, result) => (err ? reject(err) : resolve(result)))
  })
}

/** Export the entire vault as a ZIP archive. */
export async function exportVaultZip(adapter: StorageAdapter): Promise<Blob> {
  const entries = await adapter.list()
  const files: Zippable = {}
  for (const entry of entries) {
    if (entry.kind === 'folder') continue
    if (isMarkdown(entry.path)) {
      files[entry.path] = strToU8(await adapter.readText(entry.path))
    } else {
      const blob = await adapter.readBinary(entry.path)
      files[entry.path] = new Uint8Array(await blob.arrayBuffer())
    }
  }
  const zipped = await zipAsync(files)
  return new Blob([zipped.slice().buffer], { type: 'application/zip' })
}

export interface ImportSummary {
  notes: number
  attachments: number
  skipped: string[]
}

/** Import a ZIP archive into the current vault, preserving its hierarchy. */
export async function importVaultZip(
  adapter: StorageAdapter,
  archive: Blob,
): Promise<ImportSummary> {
  const data = new Uint8Array(await archive.arrayBuffer())
  const entries = await unzipAsync(data)
  const summary: ImportSummary = { notes: 0, attachments: 0, skipped: [] }
  for (const [rawPath, content] of Object.entries(entries)) {
    const path = normalizePath(rawPath)
    if (!path || rawPath.endsWith('/')) continue
    if (path.includes('..') || path.split('/').some((s) => s.startsWith('.'))) {
      summary.skipped.push(rawPath)
      continue
    }
    if (isMarkdown(path)) {
      await adapter.writeText(path, strFromU8(content))
      summary.notes++
    } else {
      await adapter.writeBinary(path, new Blob([content.slice().buffer]))
      summary.attachments++
    }
  }
  return summary
}

/** Import individual files (e.g. from a file picker or drag-and-drop). */
export async function importFiles(
  adapter: StorageAdapter,
  files: File[],
  targetFolder = '',
): Promise<ImportSummary> {
  const summary: ImportSummary = { notes: 0, attachments: 0, skipped: [] }
  for (const file of files) {
    const relative = normalizePath(
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    )
    const path = targetFolder ? `${targetFolder}/${relative}` : relative
    if (file.name.toLowerCase().endsWith('.md')) {
      await adapter.writeText(path, await file.text())
      summary.notes++
    } else if (await looksLikeZip(file)) {
      const inner = await importVaultZip(adapter, file)
      summary.notes += inner.notes
      summary.attachments += inner.attachments
      summary.skipped.push(...inner.skipped)
    } else {
      await adapter.writeBinary(path, file)
      summary.attachments++
    }
  }
  return summary
}

/** Detect a ZIP archive by extension, MIME type or magic bytes. */
async function looksLikeZip(file: File): Promise<boolean> {
  if (file.name.toLowerCase().endsWith('.zip')) return true
  if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed') return true
  if (file.size < 4) return false
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function exportNoteMarkdown(path: string, content: string): void {
  downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), `${stem(path)}.md`)
}

/** Wrap rendered note HTML in a small, self-contained document. */
export function exportNoteHtml(path: string, renderedHtml: string): void {
  const title = stem(path)
  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] ?? c)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         max-width: 46rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.65; color: #1f2523; }
  pre { background: #f4f6f5; padding: 0.8rem; border-radius: 8px; overflow-x: auto; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }
  blockquote { border-left: 3px solid #b5c4bd; margin-left: 0; padding-left: 1rem; color: #4d5a55; }
  table { border-collapse: collapse; } th, td { border: 1px solid #ccd6d1; padding: 0.35rem 0.6rem; }
  mark { background: #d3f5df; }
  a { color: #14805a; }
  .callout { border: 1px solid #ccd6d1; border-radius: 8px; padding: 0.6rem 1rem; margin: 1rem 0; }
  .callout-title { font-weight: 600; margin: 0 0 0.35rem; }
</style>
</head>
<body>
<h1>${title.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] ?? c)}</h1>
${renderedHtml}
</body>
</html>
`
  downloadBlob(new Blob([doc], { type: 'text/html;charset=utf-8' }), `${title}.html`)
}
