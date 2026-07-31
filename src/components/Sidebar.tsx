// SPDX-License-Identifier: AGPL-3.0-or-later
/** Left sidebar: renders the active panel (from the panel registry). */
import { useUi } from '@/app/uiStore'
import { getPanel } from '@/app/registries'
import { registerBuiltinPanels } from '@/app/registerBuiltins'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useSheetDrag } from '@/hooks/useSheetDrag'

registerBuiltinPanels()

export function Sidebar() {
  const sidePanel = useUi((s) => s.sidePanel)
  const Panel = getPanel(sidePanel)?.component
  const open = useUi((s) => s.sidebarOpen)
  const setOpen = useUi((s) => s.setSidebarOpen)
  const isMobile = useIsMobile()
  const drag = useSheetDrag<HTMLElement>({
    onClose: () => setOpen(false),
    direction: 'left',
    enabled: isMobile && open,
  })

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
        ref={drag.ref}
        onTouchStart={drag.onTouchStart}
        onTouchMove={drag.onTouchMove}
        onTouchEnd={drag.onTouchEnd}
        className={`sidebar${open ? ' open' : ''}`}
        aria-label="Sidebar"
        aria-hidden={!open}
        // Desktop collapses by unmounting from layout (display:none). On mobile
        // it stays mounted off-screen so the `.open` transform can slide it in.
        style={!isMobile && !open ? { display: 'none' } : undefined}
      >
        {Panel && <Panel />}
      </aside>
    </>
  )
}
