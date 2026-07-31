// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Breadcrumbs above the editor: Vault / Parent page / … / Current page.
 * Folder segments navigate to their folder note (the page that owns the
 * folder) when one exists.
 */
import { ChevronRight } from 'lucide-react'
import { useVault } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { folderNoteOf, isFolderNote, stem } from '@/utils/paths'

export function Breadcrumbs({ path }: { path: string }) {
  const vault = useVault((s) => s.vault)
  const entries = useVault((s) => s.entries)
  const metas = useVault((s) => s.metas)
  const openNote = useTabs((s) => s.openNote)

  const segments = path.split('/')
  const fileName = segments.pop() ?? ''
  // A folder note's own folder segment would duplicate the page name.
  if (isFolderNote(path)) segments.pop()

  const crumbs: Array<{ label: string; target: string | null }> = []
  let prefix = ''
  for (const segment of segments) {
    prefix = prefix ? `${prefix}/${segment}` : segment
    const indexNote = folderNoteOf(prefix)
    crumbs.push({ label: segment, target: entries.has(indexNote) ? indexNote : null })
  }
  const title = metas.get(path)?.title ?? stem(fileName)

  return (
    <nav className="breadcrumbs" aria-label="Page location">
      <span className="crumb text-faint">{vault?.name ?? 'Vault'}</span>
      {crumbs.map((crumb, i) => (
        <span key={i} className="crumb-group">
          <ChevronRight size={12} aria-hidden className="crumb-sep" />
          {crumb.target ? (
            <button className="crumb crumb-link" onClick={() => openNote(crumb.target!)}>
              {crumb.label}
            </button>
          ) : (
            <span className="crumb text-secondary">{crumb.label}</span>
          )}
        </span>
      ))}
      <span className="crumb-group">
        <ChevronRight size={12} aria-hidden className="crumb-sep" />
        <span className="crumb crumb-current" aria-current="page">
          {title}
        </span>
      </span>
    </nav>
  )
}
