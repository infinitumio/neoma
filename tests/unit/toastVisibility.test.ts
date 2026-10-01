// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { visibleToasts } from '@/components/Toasts'
import type { Toast } from '@/app/uiStore'

const toast = (kind: Toast['kind'], message = kind): Toast => ({ id: kind, kind, message })

describe('visibleToasts', () => {
  const all: Toast[] = [toast('info'), toast('success'), toast('warning'), toast('error')]

  it('shows everything on desktop', () => {
    expect(visibleToasts(all, false).map((t) => t.kind)).toEqual([
      'info',
      'success',
      'warning',
      'error',
    ])
  })

  it('never swallows a failure on the phone app', () => {
    // The regression: the phone returned null for ALL toasts. The status bar
    // that otherwise reports a failed save is display:none below 900px, so a
    // failed save produced no surface at all and the user kept typing.
    const kinds = visibleToasts(all, true).map((t) => t.kind)
    expect(kinds).toContain('error')
    expect(kinds).toContain('warning')
  })

  it('still stays quiet for routine confirmations on the phone app', () => {
    const kinds = visibleToasts(all, true).map((t) => t.kind)
    expect(kinds).not.toContain('success')
    expect(kinds).not.toContain('info')
  })

  it('keeps an actionable toast on the phone app', () => {
    // Deleting a page offers Undo only as a toast action button. Suppressing
    // info toasts on mobile removed the sole route to it.
    const undoable: Toast = {
      id: 'del',
      kind: 'info',
      message: 'Moved to Recently deleted',
      action: { label: 'Undo', run: async () => {} },
    }
    expect(visibleToasts([undoable], true)).toHaveLength(1)
  })

  it('keeps an essential toast, where nothing else can show the outcome', () => {
    // "No flashcards on this page yet" is the whole response to invoking that
    // command; suppressed, the command looks broken.
    const essential: Toast = {
      id: 'none',
      kind: 'info',
      message: 'No flashcards on this page yet',
      essential: true,
    }
    expect(visibleToasts([essential], true)).toHaveLength(1)
  })

  it('returns nothing when there is nothing to report', () => {
    expect(visibleToasts([], true)).toEqual([])
    expect(visibleToasts([toast('success')], true)).toEqual([])
  })
})
