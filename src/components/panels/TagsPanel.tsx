// SPDX-License-Identifier: AGPL-3.0-or-later
/** All tags in the vault with counts; clicking a tag searches for it. */
import { useMemo } from 'react'
import { Tag } from 'lucide-react'
import { getLinkGraph, useVault } from '@/app/vaultStore'
import { useUi } from '@/app/uiStore'

export function TagsPanel() {
  const metaVersion = useVault((s) => s.metaVersion)
  const tags = useMemo(() => {
    void metaVersion
    return [...getLinkGraph().tagCounts().entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )
  }, [metaVersion])
  const ui = useUi()

  const searchTag = (tag: string) => {
    ui.setSidePanel('search')
    // Wait for the search panel to mount before dispatching.
    setTimeout(
      () => window.dispatchEvent(new CustomEvent('neoma:search', { detail: `tag:${tag}` })),
      50,
    )
  }

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">Tags</span>
      </div>
      <div className="sidebar-body">
        {tags.length === 0 && (
          <p className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
            No tags yet. Add <code>#tags</code> to your notes or a <code>tags:</code> list in
            frontmatter.
          </p>
        )}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {tags.map(([tag, count]) => (
            <li key={tag}>
              <button className="tag-row" onClick={() => searchTag(tag)}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Tag size={13} aria-hidden />
                  {tag}
                </span>
                <span className="tag-count" aria-label={`${count} notes`}>
                  {count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
