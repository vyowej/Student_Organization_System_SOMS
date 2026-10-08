import { useEffect, useId, useRef } from 'react'
import Button from './Button.jsx'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export default function Modal({ open, title, onClose, children }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return undefined

    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement

    // Scroll lock (compensates for the scrollbar so the page doesn't jump).
    const { body, documentElement } = document
    const previousOverflow = body.style.overflow
    const previousPaddingRight = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`

    // Move focus into the dialog.
    const focusables = () => Array.from(dialog?.querySelectorAll(FOCUSABLE) ?? [])
    const first = focusables().find((el) => !el.classList.contains('modal-close')) ?? focusables()[0]
    ;(first ?? dialog)?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !dialog) return

      const items = focusables()
      if (items.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === firstItem || document.activeElement === dialog)) {
        event.preventDefault()
        lastItem.focus()
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPaddingRight
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="modal"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <Button aria-label="Close dialog" className="modal-close" onClick={onClose} variant="ghost">
            <svg aria-hidden="true" className="topbar-icon" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </Button>
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>
  )
}
