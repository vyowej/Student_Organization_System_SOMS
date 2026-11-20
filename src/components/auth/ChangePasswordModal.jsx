import { useState } from 'react'
import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'

export default function ChangePasswordModal({ open, onClose, onSubmit, userEmail = '' }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const resetAndClose = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    onClose?.()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!currentPassword) {
      setError('Enter your current password.')
      return
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.')
      return
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from your current password.')
      return
    }

    setSubmitting(true)
    try {
      const result = await onSubmit?.({ currentPassword, newPassword })
      if (!result?.ok) {
        setError(result?.error || 'Unable to update your password.')
        return
      }
      resetAndClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal onClose={resetAndClose} open={open} size="sm" title="Change Account Password">
      <form className="change-password-form" onSubmit={handleSubmit}>
        {userEmail && (
          <p className="change-password-account">
            Signed in as <strong>{userEmail}</strong>
          </p>
        )}
        <label>
          <span>Current Password</span>
          <input
            autoComplete="current-password"
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            type="password"
            value={currentPassword}
          />
        </label>
        <label>
          <span>New Password</span>
          <input
            autoComplete="new-password"
            minLength={6}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />
        </label>
        <label>
          <span>Confirm New Password</span>
          <input
            autoComplete="new-password"
            minLength={6}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
            value={confirmPassword}
          />
        </label>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="change-password-actions">
          <Button onClick={resetAndClose} type="button" variant="secondary">
            Cancel
          </Button>
          <Button disabled={submitting} type="submit" variant="primary">
            {submitting ? 'Updating…' : 'Update Password'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
