// SPDX-License-Identifier: AGPL-3.0-or-later
/** Left sidebar: renders the active panel (from the panel registry). */
import { useUi } from '@/app/uiStore'
import { getPanel } from '@/app/registries'
import { registerBuiltinPanels } from '@/app/registerBuiltins'

registerBuiltinPanels()

export function Sidebar() {
  const sidePanel = useUi((s) => s.sidePanel)
  const Panel = getPanel(sidePanel)?.component
  const open = useUi((s) => s.sidebarOpen)
  const setOpen = useUi((s) => s.setSidebarOpen)

  return (
    <>
      {open && (
        <button
          className="drawer-backdrop"
          aria-label="Close sidebar"
          tabIndex={-1}
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`sidebar${open ? ' open' : ''}`}
        aria-label="Sidebar"
        style={open ? undefined : { display: 'none' }}
      >
        {Panel && <Panel />}
      </aside>
    </>
  )
}
