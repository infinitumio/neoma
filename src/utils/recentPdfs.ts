// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Tracks recently opened PDFs per vault, in localStorage. Used by the PDF
 * viewer's "recent" list and the study dashboard. Purely local — nothing
 * leaves the device.
 */
const MAX = 12

function key(vaultId: string): string {
  return `neoma.recentPdfs.${vaultId}`
}

export function getRecentPdfs(vaultId: string | null | undefined): string[] {
  if (!vaultId) return []
  try {
    const raw = localStorage.getItem(key(vaultId))
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

export function recordRecentPdf(vaultId: string | null | undefined, path: string): void {
  if (!vaultId) return
  const next = [path, ...getRecentPdfs(vaultId).filter((p) => p !== path)].slice(0, MAX)
  try {
    localStorage.setItem(key(vaultId), JSON.stringify(next))
  } catch {
    /* storage full or unavailable — non-fatal */
  }
}

export function forgetRecentPdf(vaultId: string | null | undefined, path: string): void {
  if (!vaultId) return
  try {
    localStorage.setItem(
      key(vaultId),
      JSON.stringify(getRecentPdfs(vaultId).filter((p) => p !== path)),
    )
  } catch {
    /* non-fatal */
  }
}
