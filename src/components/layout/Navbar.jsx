/**
 * Portal Top Navigation Bar
 *
 * Displays the UNIDOS brand, active portal role label, user display name,
 * Officer-to-Student portal switcher, unread notification badge, profile link,
 * and logout confirmation modal.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth.js'
import Button from '../ui/Button.jsx'
import Icon from '../ui/Icon.jsx'
import Modal from '../ui/Modal.jsx'
import WmsuLogo from '../ui/WmsuLogo.jsx'
import { useToast } from '../ui/useToast.js'
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
  notificationCount = 0,
  notificationLink,
  profileLink,
  onMenuClick,
  isMenuOpen,
}) {
  const { currentUser, logout, setActiveRole } = useAuth()
  const { clearLastAction } = useToast()
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
          <Icon className="topbar-icon" name={isMenuOpen ? 'close' : 'menu'} size={20} />
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
        <Link
          aria-label={notificationCount > 0 ? `Notifications (${notificationCount} unread)` : 'Open notifications'}
          className="icon-button notification-button"
          to={notificationLink}
          title={notificationCount > 0 ? `${notificationCount} unread notification${notificationCount > 1 ? 's' : ''}` : 'Notifications'}
        >
          <Icon className="topbar-icon" name="bell" size={20} />
          {notificationCount > 0 && (
            <span aria-label={`${notificationCount} unread`} className="notification-badge">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          )}
        </Link>
        <Link aria-label="Open profile or settings" className="icon-button profile-link" to={profileLink} title="Profile">
          <Icon className="topbar-icon" name="user" size={20} />
        </Link>
        <Button className="topbar-logout" onClick={() => setLogoutOpen(true)} variant="secondary">Logout</Button>
      </div>
      <Modal onClose={() => setLogoutOpen(false)} open={logoutOpen} title="Confirm logout">
        <p>Are you sure you want to log out?</p>
        <div className="auth-dialog-actions">
          <Button onClick={() => setLogoutOpen(false)} variant="secondary">Cancel</Button>
          <Button onClick={() => { clearLastAction(); logout(); setLogoutOpen(false); navigate('/login', { replace: true }) }}>Log out</Button>
        </div>
      </Modal>
    </header>
  )
}
