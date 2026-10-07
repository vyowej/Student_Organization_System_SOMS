import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth.js'
import Button from '../ui/Button.jsx'
import Modal from '../ui/Modal.jsx'
import WmsuLogo from '../ui/WmsuLogo.jsx'
import { formatDisplayName } from '../../data/displayName.js'

function Brand() {
  return (
    <Link aria-label="UNIDOS home" className="brand" to="/">
      <WmsuLogo className="brand-seal" />
      <span className="brand-copy">
        <strong>UNIDOS</strong>
        <span>Student Organization Management System</span>
      </span>
    </Link>
  )
}

export { Brand }

export default function Navbar({
  role,
  notificationLink,
  profileLink,
  onMenuClick,
  isMenuOpen,
}) {
  const { currentUser, logout, setActiveRole } = useAuth()
  const navigate = useNavigate()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const roleLabel = role === 'Student'
    ? 'UNIDOS Student Portal'
    : role === 'Organization Officer'
      ? 'UNIDOS Organization Officer'
      : role === 'Organization Adviser'
        ? 'UNIDOS Adviser Portal'
        : 'UNIDOS Admin'
  const canReturnToStudentPortal = role === 'Organization Officer'
    && currentUser?.roles?.includes('STUDENT')

  function returnToStudentPortal() {
    if (setActiveRole('STUDENT')) navigate('/student/dashboard', { replace: true })
  }

  return (
    <header className="topbar">
      <div className="topbar-start">
        <button
          aria-controls="portal-sidebar"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="icon-button mobile-menu-button"
          onClick={onMenuClick}
          type="button"
        >
          {isMenuOpen ? '×' : '☰'}
        </button>
        <Brand />
        <span className="topbar-role">{roleLabel}</span>
      </div>
      <div className="topbar-actions">
        <span className="topbar-user-name">{formatDisplayName(currentUser)}</span>
        {canReturnToStudentPortal && (
          <button className="portal-switcher" onClick={returnToStudentPortal} type="button">
            Student portal
          </button>
        )}
        <Link aria-label="Open notifications" className="icon-button" to={notificationLink} title="Notifications">
          <svg aria-hidden="true" className="topbar-icon" viewBox="0 0 24 24">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
          </svg>
        </Link>
        <Link aria-label="Open profile or settings" className="icon-button profile-link" to={profileLink} title="Profile">
          <svg aria-hidden="true" className="topbar-icon" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" />
            <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
          </svg>
        </Link>
        <Button className="topbar-logout" onClick={() => setLogoutOpen(true)} variant="secondary">Logout</Button>
      </div>
      <Modal onClose={() => setLogoutOpen(false)} open={logoutOpen} title="Confirm logout">
        <p>Are you sure you want to log out?</p>
        <div className="auth-dialog-actions">
          <Button onClick={() => setLogoutOpen(false)} variant="secondary">Cancel</Button>
          <Button onClick={() => { logout(); setLogoutOpen(false); navigate('/login', { replace: true }) }}>Log out</Button>
        </div>
      </Modal>
    </header>
  )
}
