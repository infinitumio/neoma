// SPDX-License-Identifier: AGPL-3.0-or-later
/** Shared colour palette for page/attachment colour-coding and the graph. */

export const PAGE_COLORS = ['yellow', 'green', 'blue', 'purple', 'red', 'orange', 'grey'] as const
export type PageColor = (typeof PAGE_COLORS)[number]

export function isPageColor(value: unknown): value is PageColor {
  return typeof value === 'string' && (PAGE_COLORS as readonly string[]).includes(value)
}

/** Resolve a page-colour name to its solid hex, reading the current theme. */
export function pageColorHex(color: PageColor): string {
  if (typeof document === 'undefined') return '#98a39d'
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--pc-${color}`).trim()
  return value || '#98a39d'
}

/**
 * Deterministic fallback colour for a top-level folder, so graph nodes group
 * by area even before the user assigns explicit page colours.
 */
export function folderColor(folder: string): PageColor {
  if (!folder) return 'grey'
  let hash = 0
  for (let i = 0; i < folder.length; i++) hash = (hash * 31 + folder.charCodeAt(i)) | 0
  const palette: PageColor[] = ['blue', 'green', 'purple', 'orange', 'red', 'yellow']
  return palette[Math.abs(hash) % palette.length]
}
