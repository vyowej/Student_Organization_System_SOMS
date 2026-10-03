import { useEffect } from 'react'
import Button from './Button.jsx'

export default function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined

    function closeOnEscape(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section aria-labelledby="modal-title" aria-modal="true" className="modal" role="dialog">
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <Button aria-label="Close dialog" className="modal-close" onClick={onClose} variant="ghost">
            ×
          </Button>
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  )
}
