import { useCallback, useMemo, useState } from 'react'
import { ToastContext } from './useToast.js'

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((message, tone = 'info', options = {}) => {
    const id = `${Date.now()}-${Math.random()}`
    const { action = null, duration = 4200 } = options || {}
    const cleanAction = action && action.label !== 'Undo' ? action : null
    setToasts((current) => [...current, { id, message, tone, action: cleanAction }])
    window.setTimeout(() => dismissToast(id), duration)
    return id
  }, [dismissToast])

  const clearLastAction = useCallback(() => {}, [])
  const undoLast = useCallback(() => {}, [])

  const value = useMemo(
    () => ({ showToast, lastAction: null, undoLast, clearLastAction }),
    [showToast, undoLast, clearLastAction],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="toast-region" role="status">
        {toasts.map((toast) => (
          <div className={`toast${toast.tone === 'info' ? '' : ` toast-${toast.tone}`}`} key={toast.id}>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                className="toast-action"
                onClick={() => {
                  toast.action.onClick()
                  dismissToast(toast.id)
                }}
                type="button"
              >
                {toast.action.label}
              </button>
            )}
            <button
              aria-label="Dismiss notification"
              className="toast-close"
              onClick={() => dismissToast(toast.id)}
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
