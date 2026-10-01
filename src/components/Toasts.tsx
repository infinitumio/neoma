// SPDX-License-Identifier: AGPL-3.0-or-later
import { X } from 'lucide-react'
import { useUi, type Toast } from '@/app/uiStore'
import { useSettings } from '@/settings/settingsStore'
import { isMobileApp } from '@/desktop/tauri'

/**
 * Which toasts a platform shows.
 *
 * The phone app stays quiet for routine confirmations — stacking "Page created"
 * notifications is desktop chrome, and iOS convention is to show success in the
 * UI itself. Failures are different: the status bar that reports them on desktop
 * is `display: none` below 900px, so suppressing an error toast on a phone left
 * *no* surface at all. A failed save reported nothing and the user kept typing.
 *
 * Errors and warnings therefore always show. So does any toast carrying an
 * action: that button is the *only* route to it — deleting a page offered Undo
 * nowhere else — which makes it an affordance rather than a confirmation.
 *
 * So does anything flagged `essential`: an outcome the interface cannot show by
 * itself. "No flashcards on this page yet" is the entire response to invoking
 * that command, so suppressing it made the command look broken.
 *
 * Plain success and info stay desktop-only — a created page appears in the
 * tree, a colour change updates its dot, and neither needs narrating.
 */
export function visibleToasts(toasts: Toast[], mobile: boolean): Toast[] {
  if (!mobile) return toasts
  return toasts.filter(
    (t) => t.kind === 'error' || t.kind === 'warning' || Boolean(t.action) || t.essential === true,
  )
}

export function Toasts() {
  const all = useUi((s) => s.toasts)
  const dismiss = useUi((s) => s.dismissToast)
  const showDismiss = useSettings((s) => s.settings.showToastIcons)
  const toasts = visibleToasts(all, isMobileApp())
  if (!toasts.length) return null
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind}`}>
          <div className="toast-body">{toast.message}</div>
          {toast.action && (
            <button
              className="btn btn-ghost"
              onClick={() => {
                dismiss(toast.id)
                void toast.action!.run()
              }}
            >
              {toast.action.label}
            </button>
          )}
          {showDismiss && (
            <button
              className="icon-btn"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={14} aria-hidden />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
