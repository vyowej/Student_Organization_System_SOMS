import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import Button from './Button.jsx'
import Icon from './Icon.jsx'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

let openModalCount = 0
let previousBodyOverflow = ''
let previousBodyPaddingRight = ''

function lockBodyScroll() {
  if (openModalCount === 0) {
    const { body, documentElement } = document
    previousBodyOverflow = body.style.overflow
    previousBodyPaddingRight = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`
  }
  openModalCount += 1
}

function unlockBodyScroll() {
  openModalCount = Math.max(0, openModalCount - 1)
  if (openModalCount === 0) {
    document.body.style.overflow = previousBodyOverflow
    document.body.style.paddingRight = previousBodyPaddingRight
  }
}

export function resolveModalTone(tone = '', status = '') {
  const direct = String(tone || '').trim().toLowerCase()
  if (['success', 'warning', 'danger', 'info'].includes(direct)) return direct

  const norm = String(status || '').trim().toUpperCase().replace(/\s+/g, '_')
  if (!norm) return ''
  if (['APPROVED', 'PUBLISHED', 'VERIFIED', 'ACTIVE', 'ATTENDED', 'REGISTERED', 'COMPLETED'].includes(norm)) {
    return 'success'
  }
  if (['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'PENDING_VERIFICATION', 'RETURNED', 'RETURNED_FOR_REVISION', 'DRAFT', 'INACTIVE', 'DEMOTE'].includes(norm)) {
    return 'warning'
  }
  if (['REJECTED', 'CANCELLED', 'SUSPENDED', 'ARCHIVED', 'REMOVE', 'REMOVED', 'EVENT_FULL', 'REGISTRATION_CLOSED'].includes(norm)) {
    return 'danger'
  }
  return ''
}

export default function Modal({
  open,
  title,
  onClose,
  children,
  size = 'md',
  tone = '',
  status = '',
  className = '',
}) {
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

    // Scroll lock with reference counting so nested/stacked dialogs never get stuck
    lockBodyScroll()

    // Move focus into the dialog.
    const focusables = () => Array.from(dialog?.querySelectorAll(FOCUSABLE) ?? [])
    const first = focusables().find((el) => !el.classList.contains('modal-close')) ?? focusables()[0]
      ; (first ?? dialog)?.focus()

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
      unlockBodyScroll()
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [open])

  if (!open) return null

  const resolvedTone = resolveModalTone(tone, status)
  const toneClass = resolvedTone ? `modal--tone-${resolvedTone}` : ''

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className={`modal modal--${size} ${toneClass} ${className}`.trim()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <Button aria-label="Close dialog" className="modal-close" onClick={onClose} variant="ghost">
            <Icon className="topbar-icon" name="close" size={18} />
          </Button>
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>,
    document.body,
  )
}
