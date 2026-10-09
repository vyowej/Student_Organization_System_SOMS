import { useContext } from 'react'
import ToastContext from './ToastContext.jsx'

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}

// Toast option that adds an Undo button: showToast(msg, 'success', undoAction(undo))
export function undoAction(undo) {
  return { action: { label: 'Undo', onClick: undo } }
}
