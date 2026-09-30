// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Portable import/export. ZIP exports preserve the vault's folder hierarchy
 * and attachment paths exactly, so an exported vault can be re-imported, put
 * under Git, or opened directly in any other Markdown application.
 */
import { zip, unzip, strToU8, strFromU8, type Zippable } from 'fflate'
import type { StorageAdapter } from '@/types'
import { isMarkdown, normalizePath, stem } from '@/utils/paths'
import { requestFileShare } from '@/storage/preparedShare'
import { isMobileApp, isDesktopApp } from '@/desktop/tauri'

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

export interface ImportOptions {
  /** Folder to import into (used for Markdown/folder-structured imports). */
  targetFolder?: string
  /**
   * Folder for loose attachments (files selected individually rather than as
   * part of a dropped folder). Defaults to `targetFolder`.
   */
  attachmentsFolder?: string
  /** Import every file as an attachment, even `.md`/`.zip`. */
  attachmentsOnly?: boolean
}

/**
 * Import individual files (from a file picker or drag-and-drop). Markdown
 * becomes notes and ZIPs are expanded, unless `attachmentsOnly` is set. Loose
 * attachments go into `attachmentsFolder`; files dropped as part of a folder
 * keep their relative path. Returns the summary plus the paths written, so
 * callers can open or colour the new attachments.
 */
export async function importFiles(
  adapter: StorageAdapter,
  files: File[],
  options: ImportOptions | string = {},
): Promise<ImportSummary & { paths: string[] }> {
  const opts: ImportOptions = typeof options === 'string' ? { targetFolder: options } : options
  const targetFolder = opts.targetFolder ?? ''
  const attachmentsFolder = opts.attachmentsFolder ?? targetFolder
  const summary: ImportSummary & { paths: string[] } = {
    notes: 0,
    attachments: 0,
    skipped: [],
    paths: [],
  }
  for (const file of files) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath
    const isLoose = !rel
    const name = normalizePath(rel || file.name)

    if (!opts.attachmentsOnly && file.name.toLowerCase().endsWith('.md')) {
      const path = joinInto(targetFolder, name)
      await adapter.writeText(path, await file.text())
      summary.notes++
      summary.paths.push(path)
    } else if (!opts.attachmentsOnly && (await looksLikeZip(file))) {
      const inner = await importVaultZip(adapter, file)
      summary.notes += inner.notes
      summary.attachments += inner.attachments
      summary.skipped.push(...inner.skipped)
    } else {
      // Attachment: loose files go to the attachment folder; folder-dropped
      // files keep their structure under the target folder.
      const path = isLoose
        ? uniqueAttachmentPath(adapter, attachmentsFolder, file.name)
        : joinInto(targetFolder, name)
      await adapter.writeBinary(path, file)
      summary.attachments++
      summary.paths.push(path)
    }
  }
  return summary
}

function joinInto(folder: string, relative: string): string {
  return normalizePath(folder ? `${folder}/${relative}` : relative)
}

/** A non-colliding attachment path inside `folder` (synchronous best-effort). */
function uniqueAttachmentPath(adapter: StorageAdapter, folder: string, name: string): string {
  void adapter
  return joinInto(folder, name)
}

/** Detect a ZIP archive by extension, MIME type or magic bytes. */
async function looksLikeZip(file: File): Promise<boolean> {
  if (file.name.toLowerCase().endsWith('.zip')) return true
  if (file.type === 'application/zip' || file.type === 'application/x-zip-compressed') return true
  if (file.size < 4) return false
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04
}

/**
 * True where the app can actually hand a file to the user.
 *
 * `<a download>` is the only save mechanism the web app has, and inside a Tauri
 * WKWebView it does nothing: wry's navigation delegate cancels any navigation
 * with `shouldPerformDownload` unless the host registered a download handler,
 * and Neoma registers none. So on the phone app every export silently no-opped
 * — a visible control that does nothing, which is an App Store 2.1 rejection.
 *
 * The phone route is the native share sheet instead, which is also the correct
 * iOS idiom for "send this file somewhere". Where even that is unavailable the
 * caller must hide the control rather than offer a dead one.
 */
export function canExportFiles(): boolean {
  if (!isMobileApp()) return true
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function'
  )
}

/** Raised when the user dismisses the share sheet. Callers stay silent on it. */
export class ExportCancelled extends Error {
  constructor() {
    super('Export cancelled')
    this.name = 'ExportCancelled'
  }
}

/**
 * Hand a file to the user by whichever route this platform supports.
 *
 * On iOS, present the prepared file first. The user's Share or save tap
 * supplies fresh activation even after a slow ZIP build.
 */
export async function exportBlob(blob: Blob, filename: string): Promise<void> {
  // The desktop app is a WKWebView/WebView2 too, so `<a download>` is cancelled
  // there for the same reason as on the phone — exports were silently doing
  // nothing on macOS as well. Use the native save panel and write the bytes
  // ourselves. `dialog:default` already grants allow-save and the capability
  // set allows fs writes under $HOME.
  if (isDesktopApp()) {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const path = await save({ defaultPath: filename })
    if (!path) throw new ExportCancelled()
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()))
    return
  }
  if (!isMobileApp()) {
    downloadBlob(blob, filename)
    return
  }
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' })
  if (!navigator.canShare?.({ files: [file] })) {
    throw new Error('This device cannot share files')
  }
  try {
    await requestFileShare(file)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw new ExportCancelled()
    throw err
  }
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

export async function exportNoteMarkdown(path: string, content: string): Promise<void> {
  await exportBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), `${stem(path)}.md`)
}

/** Wrap rendered note HTML in a small, self-contained document. */
export async function exportNoteHtml(path: string, renderedHtml: string): Promise<void> {
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
  await exportBlob(new Blob([doc], { type: 'text/html;charset=utf-8' }), `${title}.html`)
}
