// SPDX-License-Identifier: AGPL-3.0-or-later
/** Recently deleted notes: restore or permanently remove. */
import { useEffect } from 'react'
import { RotateCcw, Trash2 } from 'lucide-react'
import { useVault, refreshTrash, restoreFromTrash, purgeTrashItem } from '@/app/vaultStore'
import { useTabs } from '@/app/tabsStore'
import { useUi } from '@/app/uiStore'
import { friendlyDateTime } from '@/utils/dates'
import { formatBytes } from '@/utils/misc'

export function TrashPanel() {
  const trash = useVault((s) => s.trash)
  const ui = useUi()

  useEffect(() => {
    void refreshTrash()
  }, [])

  const restore = async (id: string) => {
    const path = await restoreFromTrash(id)
    if (path) {
      ui.toast(`Restored to ${path}`, 'success')
      if (path.endsWith('.md')) useTabs.getState().openNote(path)
    }
  }

  const purge = (id: string, name: string) => {
    ui.askConfirm({
      title: 'Delete permanently?',
      message: `"${name}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete permanently',
      danger: true,
      onConfirm: () => purgeTrashItem(id),
    })
  }

  return (
    <>
      <div className="sidebar-header">
        <span className="sidebar-title">Recently deleted</span>
      </div>
      <div className="sidebar-body">
        {trash.length === 0 && (
          <p className="text-small text-faint" style={{ padding: 'var(--space-2)' }}>
            Nothing here. Deleted notes can be restored from this panel.
          </p>
        )}
        {trash.map((item) => (
          <div key={item.id} className="backlink-card" style={{ cursor: 'default' }}>
            <div className="backlink-title">{item.originalPath}</div>
            <div className="backlink-context">
              Deleted {friendlyDateTime(item.deletedAt)} · {formatBytes(item.size)}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <button className="btn" onClick={() => void restore(item.id)}>
                <RotateCcw size={13} aria-hidden /> Restore
              </button>
              <button className="btn btn-danger" onClick={() => purge(item.id, item.originalPath)}>
                <Trash2 size={13} aria-hidden /> Delete forever
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
