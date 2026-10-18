import Button from './Button.jsx'
import Modal from './Modal.jsx'

/**
 * Standard "Are you sure?" prompt for important actions.
 * `message` states exactly what will happen; `confirmLabel` repeats the action
 * ("Publish event", not "OK") so the button and the toast that follows agree.
 */
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  details = null,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  confirmDisabled = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal onClose={onCancel} open={open} title={title}>
      {message && <p>{message}</p>}
      {details}
      <div className="auth-dialog-actions">
        <Button onClick={onCancel} variant="secondary">{cancelLabel}</Button>
        <Button disabled={confirmDisabled} onClick={onConfirm} variant={tone}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}
