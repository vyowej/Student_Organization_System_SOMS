import { useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Button from './Button.jsx'
import Icon from './Icon.jsx'
import ModalContainerContext from './ModalContainerContext.js'

export default function ModalAlert({ open, title, message, onClose, returnFocusRef }) {
  const modalContainerRef = useContext(ModalContainerContext)
  const [portalTarget, setPortalTarget] = useState(null)
  const titleId = useId()
  const messageId = useId()
  const okButtonRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (open) setPortalTarget(modalContainerRef?.current ?? null)
    else setPortalTarget(null)
  }, [modalContainerRef, open])

  useEffect(() => {
    if (!open || !portalTarget) return undefined
    const returnFocusElement = returnFocusRef?.current
    okButtonRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onCloseRef.current()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      returnFocusElement?.focus()
    }
  }, [open, portalTarget, returnFocusRef])

  if (!open || !portalTarget) return null

  return createPortal((
    <div
      className="modal-alert-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        aria-describedby={messageId}
        aria-labelledby={titleId}
        aria-live="assertive"
        aria-modal="true"
        className="modal-alert-card"
        role="alertdialog"
      >
        <span aria-hidden="true" className="modal-alert-icon">
          <Icon name="alert-triangle" size={24} />
        </span>
        <h2 id={titleId}>{title}</h2>
        <p id={messageId}>{message}</p>
        <Button onClick={onClose} ref={okButtonRef} type="button">OK</Button>
      </section>
    </div>
  ), portalTarget)
}
