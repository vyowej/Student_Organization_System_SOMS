import { useEffect } from 'react'
import { useToast } from './useToast.js'

/**
 * Persistent "last action" bar with an Undo button. Rendered once in the portal
 * layout, so it shows on every page of every portal (student, officer, adviser,
 * admin) for as long as the last change can still be undone. Ctrl/Cmd+Z works too.
 */
export default function UndoBar() {
  const { lastAction, undoLast, clearLastAction } = useToast()

  useEffect(() => {
    if (!lastAction) return undefined
    function onKeyDown(event) {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return
      const target = event.target
      const typing = target instanceof HTMLElement
        && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      if (typing || document.querySelector('.modal-backdrop')) return
      event.preventDefault()
      undoLast()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [lastAction, undoLast])

  if (!lastAction) return null

  return (
    <div className="undo-bar" role="status">
      <svg aria-hidden="true" className="undo-bar-icon" viewBox="0 0 24 24"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
      <span className="undo-bar-message"><strong>Last action:</strong> {lastAction.message}</span>
      <button className="undo-bar-button" onClick={undoLast} type="button">Undo <kbd>Ctrl+Z</kbd></button>
      <button aria-label="Dismiss undo bar" className="undo-bar-close" onClick={clearLastAction} type="button">×</button>
    </div>
  )
}
