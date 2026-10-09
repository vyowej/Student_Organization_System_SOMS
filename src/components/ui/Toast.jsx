import { useCallback, useMemo, useState } from 'react'
import ToastContext from './ToastContext.jsx'

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  // The most recent undoable action. Unlike a toast it stays until it is used,
  // dismissed, replaced by a newer action, or the user logs out, so an undo is
  // always one click away (see UndoBar).
  const [lastAction, setLastAction] = useState(null)

  const pushToast = useCallback((message, tone, options) => {
    const id = `${Date.now()}-${Math.random()}`
    const { action = null, duration = action ? 9000 : 4500 } = options
    setToasts((current) => [...current, { id, message, tone, action }])
    window.setTimeout(() => dismissToast(id), duration)
    return id
  }, [dismissToast])

  const runUndo = useCallback((actionId, undo) => {
    undo()
    setLastAction((current) => (current?.id === actionId ? null : current))
    pushToast('Action undone.', 'info', {})
  }, [pushToast])

  // options.action = { label, onClick } adds a button (e.g. Undo); such toasts stay longer.
  // An "Undo" action is also remembered as lastAction so it stays available after the toast is gone.
  const showToast = useCallback((message, tone = 'info', options = {}) => {
    const { action = null } = options
    if (action?.label === 'Undo') {
      const actionId = `${Date.now()}-${Math.random()}`
      const run = () => runUndo(actionId, action.onClick)
      setLastAction({ id: actionId, message, undo: run })
      pushToast(message, tone, { ...options, action: { ...action, onClick: run } })
      return
    }
    pushToast(message, tone, options)
  }, [pushToast, runUndo])

  const undoLast = useCallback(() => {
    if (lastAction) lastAction.undo()
  }, [lastAction])
  const clearLastAction = useCallback(() => setLastAction(null), [])

  const value = useMemo(
    () => ({ showToast, lastAction, undoLast, clearLastAction }),
    [showToast, lastAction, undoLast, clearLastAction],
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
