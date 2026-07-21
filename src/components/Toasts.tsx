// SPDX-License-Identifier: AGPL-3.0-or-later
import { X } from 'lucide-react'
import { useUi } from '@/app/uiStore'

export function Toasts() {
  const toasts = useUi((s) => s.toasts)
  const dismiss = useUi((s) => s.dismissToast)
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
          <button
            className="icon-btn"
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  )
}
