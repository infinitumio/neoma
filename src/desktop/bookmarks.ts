// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * macOS security-scoped bookmarks — the frontend half of src-tauri/src/bookmarks.rs.
 *
 * A Mac App Store build runs in the App Sandbox, where a saved folder path is
 * just a string the sandbox will refuse on the next launch. Bookmarks are the
 * sanctioned way to keep access: mint one when the user picks a vault folder,
 * redeem it before reading. Without this a MAS build appears to lose the user's
 * vault every time it restarts.
 *
 * Every function here degrades to a no-op rather than throwing. The unsandboxed
 * direct-download desktop build, Windows, Linux and the browser all work fine
 * without bookmarks, so a failure to mint or redeem one must never be fatal —
 * it just means we fall back to the plain path, which is exactly right
 * everywhere except the sandbox.
 */
import { isTauri } from './tauri'

export type ResolvedBookmark = { path: string; stale: boolean }

/**
 * Mint a bookmark for a folder the user just chose. Returns null when bookmarks
 * don't apply (non-macOS, browser) or can't be created — callers store the null
 * and carry on with the path.
 */
export async function createBookmark(path: string): Promise<string | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<string>('bookmark_create', { path })
  } catch {
    // Expected on Windows/Linux, where the command returns Unsupported.
    return null
  }
}

/**
 * Redeem a stored bookmark and begin accessing the folder.
 *
 * The returned path is authoritative and may differ from the one stored: a
 * bookmark tracks the folder, so it still resolves after the user moves or
 * renames it. Callers should persist the returned path.
 */
export async function resolveBookmark(bookmark: string): Promise<ResolvedBookmark | null> {
  if (!isTauri()) return null
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    return await invoke<ResolvedBookmark>('bookmark_resolve', { bookmark })
  } catch {
    // A refused or corrupt bookmark lands here. The caller falls back to the
    // stored path, which works everywhere except the sandbox — and in the
    // sandbox the subsequent read fails loudly, which is the honest outcome.
    return null
  }
}
