// SPDX-License-Identifier: AGPL-3.0-or-later
/** Note-header button to colour-code the current page (stored in frontmatter). */
import { useState } from 'react'
import { Circle } from 'lucide-react'
import { ColorPicker } from './ColorPicker'
import { getEntryColor, setEntryColor, useVault } from '@/app/vaultStore'
import { useUi } from '@/app/uiStore'
import type { PageColor } from '@/utils/colors'

export function PageColorButton({ path }: { path: string }) {
  const [open, setOpen] = useState(false)
  useVault((s) => s.metaVersion)
  const current = getEntryColor(path)

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="icon-btn"
        aria-label="Page colour"
        title="Colour this page"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Circle
          size={15}
          aria-hidden
          fill={current ? `var(--pc-${current})` : 'transparent'}
          color={current ? `var(--pc-${current})` : 'currentColor'}
        />
      </button>
      {open && (
        <div className="color-picker-anchor">
          <ColorPicker
            current={current}
            onClose={() => setOpen(false)}
            onPick={(color: PageColor | null) => {
              void setEntryColor(path, color).then(() =>
                useUi
                  .getState()
                  .toast(color ? 'Page colour set' : 'Page colour removed', 'success'),
              )
            }}
          />
        </div>
      )}
    </div>
  )
}
