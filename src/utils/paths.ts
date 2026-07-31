// SPDX-License-Identifier: AGPL-3.0-or-later
/** Vault-relative path helpers. Paths use `/` and never begin with `/`. */

export function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '')
}

export function dirname(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

export function basename(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? path : path.slice(i + 1)
}

export function extension(path: string): string {
  const name = basename(path)
  const i = name.lastIndexOf('.')
  return i <= 0 ? '' : name.slice(i + 1).toLowerCase()
}

/** File name without its extension. */
export function stem(path: string): string {
  const name = basename(path)
  const i = name.lastIndexOf('.')
  return i <= 0 ? name : name.slice(0, i)
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.filter(Boolean).join('/'))
}

export function isMarkdown(path: string): boolean {
  return extension(path) === 'md'
}

export function isWithin(folder: string, path: string): boolean {
  if (!folder) return true
  return path === folder || path.startsWith(folder + '/')
}

// eslint-disable-next-line no-control-regex -- control chars are invalid in file names
const INVALID_NAME = /[<>:"|?*\\/\u0000-\u001f]/g

/** Sanitise a user-supplied note/folder name into a safe file name segment. */
export function sanitizeName(name: string): string {
  const clean = name.replace(INVALID_NAME, '').trim().replace(/\.+$/, '')
  return clean || 'Untitled'
}

/** Produce `Name.md`, `Name 1.md`, `Name 2.md`… until it does not collide. */
export function uniquePath(desired: string, exists: (p: string) => boolean): string {
  if (!exists(desired)) return desired
  const dir = dirname(desired)
  const base = stem(desired)
  const ext = extension(desired)
  for (let i = 1; ; i++) {
    const candidate = joinPath(dir, `${base} ${i}${ext ? '.' + ext : ''}`)
    if (!exists(candidate)) return candidate
  }
}

/* ---- Page hierarchy (folder-note convention) --------------------------
 * A "page with subpages" is stored portably as a folder plus an index note
 * named after it:  Machine Learning/Machine Learning.md
 * Nothing proprietary: any Markdown tool sees an ordinary folder layout.
 */

/** The index note that represents `folderPath` as a page. */
export function folderNoteOf(folderPath: string): string {
  return joinPath(folderPath, `${basename(folderPath)}.md`)
}

/** True when `path` is a folder's index note (e.g. `A/B/B.md`). */
export function isFolderNote(path: string): boolean {
  const dir = dirname(path)
  return dir !== '' && isMarkdown(path) && stem(path) === basename(dir)
}

/** The folder a page owns when it has subpages, or null. */
export function pageFolderOf(notePath: string): string | null {
  return isFolderNote(notePath) ? dirname(notePath) : null
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp'])

export function isImage(path: string): boolean {
  return IMAGE_EXTENSIONS.has(extension(path))
}

export function isPdf(path: string): boolean {
  return extension(path) === 'pdf'
}
