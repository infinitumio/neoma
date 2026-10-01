// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Portable device sync: move a vault between your own devices via a single
 * `.neomavault` file (a ZIP of notes + attachments plus a hashed manifest).
 * The manifest carries the vault id and a SHA-256 per note, so importing can
 * verify "is this my vault?" and merge changes without ever overwriting local
 * edits: new notes are added, and differing notes are kept as a separate synced
 * copy (conflicts are never silently discarded). No account, no server.
 *
 * Two-way convergence, a diff/merge screen, and hosted cloud sync are tracked
 * in issues #17 and #29.
 */
import { zip, unzip, strToU8, strFromU8 } from 'fflate'
import { flushAllSaves, getAdapter, useVault, refreshEntries } from '@/app/vaultStore'
import { exportBlob } from '@/storage/import-export'
import { stem } from '@/utils/paths'
import type { StorageAdapter } from '@/types'

const isMarkdown = (path: string) => /\.md$/i.test(path)

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

interface SyncManifest {
  neomaSync: 1
  vaultId: string
  vaultName: string
  exportedAt: number
  /** Hash over every "path:hash" line; identifies the vault's content. */
  fingerprint: string
  /** Note path -> content hash. */
  files: Record<string, string>
}

async function readNotes(adapter: StorageAdapter): Promise<Map<string, string>> {
  const entries = await adapter.list()
  const notes = new Map<string, string>()
  for (const entry of entries) {
    if (entry.kind === 'file' && isMarkdown(entry.path)) {
      notes.set(entry.path, await adapter.readText(entry.path))
    }
  }
  return notes
}

async function buildManifest(
  vaultId: string,
  vaultName: string,
  notes: Map<string, string>,
): Promise<SyncManifest> {
  const files: Record<string, string> = {}
  for (const [path, content] of notes) files[path] = await sha256(content)
  const fingerprint = await sha256(
    Object.keys(files)
      .sort()
      .map((p) => `${p}:${files[p]}`)
      .join('\n'),
  )
  return { neomaSync: 1, vaultId, vaultName, exportedAt: Date.now(), fingerprint, files }
}

/** Save the current vault as a portable `.neomavault` bundle. */
export async function exportVaultBundle(): Promise<number> {
  await flushAllSaves()
  const adapter = getAdapter()
  const vault = useVault.getState().vault
  if (!adapter || !vault) throw new Error('No vault is open')

  const notes = await readNotes(adapter)
  const manifest = await buildManifest(vault.id, vault.name, notes)
  const files: Record<string, Uint8Array> = {
    'neoma-sync.json': strToU8(JSON.stringify(manifest)),
  }
  for (const [path, content] of notes) files[path] = strToU8(content)

  // Attachments travel too, so images and PDFs resolve on the other device.
  for (const entry of await adapter.list()) {
    if (entry.kind !== 'file' || isMarkdown(entry.path)) continue
    try {
      const blob = await adapter.readBinary(entry.path)
      files[entry.path] = new Uint8Array(await blob.arrayBuffer())
    } catch {
      /* skip unreadable files */
    }
  }

  const zipped = await new Promise<Uint8Array>((resolve, reject) =>
    zip(files, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data))),
  )
  const safeName = vault.name.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || 'vault'
  await exportBlob(
    new Blob([zipped.slice().buffer], { type: 'application/octet-stream' }),
    `${safeName}.neomavault`,
  )
  return notes.size
}

export interface SyncPreview {
  /** True when the bundle's vault id matches the open vault (same vault). */
  sameVault: boolean
  incomingVaultName: string
  /** Notes in the bundle not present locally (will be added). */
  added: string[]
  /** Notes that differ from local (will be kept as a separate synced copy). */
  changed: string[]
  /** Notes byte-identical to local. */
  identical: number
  /** Apply the merge. Non-destructive: never overwrites a local note. */
  apply: () => Promise<{ added: number; conflicts: number }>
}

/** Inspect a `.neomavault` bundle and prepare a non-destructive merge. */
export async function readVaultBundle(file: Blob): Promise<SyncPreview> {
  const adapter = getAdapter()
  const vault = useVault.getState().vault
  if (!adapter || !vault) throw new Error('No vault is open')

  const data = new Uint8Array(await file.arrayBuffer())
  const bundle = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
    unzip(data, (err, files) => (err ? reject(err) : resolve(files))),
  )
  const manifestRaw = bundle['neoma-sync.json']
  if (!manifestRaw) throw new Error('This is not a Neoma vault file')
  const manifest = JSON.parse(strFromU8(manifestRaw)) as SyncManifest

  const local = await readNotes(adapter)
  const localHash = new Map<string, string>()
  for (const [path, content] of local) localHash.set(path, await sha256(content))

  const added: string[] = []
  const changed: string[] = []
  let identical = 0
  for (const [path, hash] of Object.entries(manifest.files)) {
    const lh = localHash.get(path)
    if (lh === undefined) added.push(path)
    else if (lh === hash) identical++
    else changed.push(path)
  }

  const apply = async () => {
    let addedCount = 0
    let conflicts = 0
    const stamp = new Date(manifest.exportedAt).toISOString().slice(0, 10)
    for (const path of added) {
      const content = bundle[path]
      if (!content) continue
      await adapter.writeText(path, strFromU8(content))
      addedCount++
    }
    for (const path of changed) {
      const content = bundle[path]
      if (!content) continue
      // Keep both: write the incoming version beside the local one.
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : ''
      const copyPath = `${dir}${stem(path)} (synced ${stamp}).md`
      await adapter.writeText(copyPath, strFromU8(content))
      conflicts++
    }
    // Bring over any attachments that are missing locally.
    for (const [path, content] of Object.entries(bundle)) {
      if (path === 'neoma-sync.json' || isMarkdown(path)) continue
      if (!(await adapter.exists(path))) {
        await adapter.writeBinary(path, new Blob([content.slice().buffer]))
      }
    }
    if (addedCount || conflicts) await refreshEntries()
    return { added: addedCount, conflicts }
  }

  return {
    sameVault: manifest.vaultId === vault.id,
    incomingVaultName: manifest.vaultName,
    added,
    changed,
    identical,
    apply,
  }
}
