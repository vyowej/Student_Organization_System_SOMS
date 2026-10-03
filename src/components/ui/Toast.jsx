import { useCallback, useMemo, useState } from 'react'
import ToastContext from './ToastContext.jsx'

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((message, tone = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => dismissToast(id), 4500)
  }, [dismissToast])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="toast-region" role="status">
        {toasts.map((toast) => (
          <div className={`toast${toast.tone === 'info' ? '' : ` toast-${toast.tone}`}`} key={toast.id}>
            <span>{toast.message}</span>
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
