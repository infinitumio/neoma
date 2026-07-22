// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Manual ordering of pages within a folder. Files are sorted by name by
 * default; when the user drags to reorder, we remember an explicit order per
 * folder (in localStorage, per vault). Anything not in the saved order falls
 * back to the normal sort, appended after the ordered items.
 */
export type FolderOrder = Record<string, string[]>

function key(vaultId: string): string {
  return `neoma.fileorder.${vaultId}`
}

export function loadOrder(vaultId: string | null | undefined): FolderOrder {
  if (!vaultId) return {}
  try {
    const raw = localStorage.getItem(key(vaultId))
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as FolderOrder) : {}
  } catch {
    return {}
  }
}

export function saveFolderOrder(
  vaultId: string | null | undefined,
  folder: string,
  ordered: string[],
): FolderOrder {
  const all = loadOrder(vaultId)
  all[folder] = ordered
  if (vaultId) {
    try {
      localStorage.setItem(key(vaultId), JSON.stringify(all))
    } catch {
      /* storage full — non-fatal */
    }
  }
  return { ...all }
}
