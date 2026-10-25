import Button from './Button.jsx'
import Icon from './Icon.jsx'
import Modal from './Modal.jsx'

/**
 * Standard confirmation dialog for important actions.
 * Provides consistent layout, icon badge, message copy, and actions
 * aligned with the UNIDOS design system.
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  details = null,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  icon = null,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}) {
  const isDanger = tone === 'danger'
  const displayIcon = icon ?? (isDanger ? 'alert-triangle' : 'alert-circle')

  return (
    <Modal className="confirm-dialog-modal" onClose={onCancel} open={open} size="sm" title={title}>
      <div className="confirm-dialog-content">
        <span aria-hidden="true" className={`confirm-dialog-icon confirm-dialog-icon--${isDanger ? 'danger' : 'primary'}`}>
          <Icon name={displayIcon} size={28} />
        </span>
        {message && <p className="confirm-dialog-message">{message}</p>}
        {details}
      </div>
      <div className="confirm-dialog-actions auth-dialog-actions">
        <Button onClick={onCancel} variant="secondary">{cancelLabel}</Button>
        <Button disabled={confirmDisabled} onClick={onConfirm} variant={tone}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}
