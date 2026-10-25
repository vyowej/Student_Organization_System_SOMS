/**
 * Portal Top Navigation Bar
 *
 * Displays the UNIDOS brand, active portal role label, user display name,
 * Officer-to-Student portal switcher, unread notification badge, profile link,
 * and logout confirmation modal.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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

function NotificationPopover({
  role,
  notificationCount,
  notificationLink,
  notifications,
  onMarkAllNotificationsRead,
  onMarkNotificationRead,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [openAtPath, setOpenAtPath] = useState(null)
  const open = openAtPath === location.pathname
  const [filter, setFilter] = useState('All')
  const [moreOpen, setMoreOpen] = useState(false)
  const triggerRef = useRef(null)
  const dialogRef = useRef(null)
  const wasOpen = useRef(false)
  const title = 'Notifications'
  const filteredItems = notifications.filter((item) => {
    if (filter === 'Unread') return !item.read
    return true
  })

  useEffect(() => {
    if (!open) {
      if (wasOpen.current) triggerRef.current?.focus()
      wasOpen.current = false
      return undefined
    }
    wasOpen.current = true
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const dialog = dialogRef.current
    if (window.matchMedia('(max-width: 1024px)').matches) document.body.style.overflow = 'hidden'
    const focusable = () => [...(dialog?.querySelectorAll('button:not([disabled]), a[href]') ?? [])]
    focusable()[0]?.focus()

    function onPointerDown(event) {
      if (!dialog?.contains(event.target) && !triggerRef.current?.contains(event.target)) setOpenAtPath(null)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setOpenAtPath(null)
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const items = focusable()
      if (!items.length) return
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault()
        items.at(-1)?.focus()
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault()
        items[0]?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement && !dialog?.contains(previousFocus)) previousFocus.focus()
    }
  }, [open])

  function openItem(item) {
    onMarkNotificationRead(item)
    setOpenAtPath(null)
    navigate(item.to || notificationLink)
  }

  function renderItem(item) {
    return (
      <article className={`notification-popover-item${item.read ? '' : ' is-unread'}`} key={`${item.source}-${item.id}`}>
        <button className="notification-item-open" onClick={() => openItem(item)} type="button">
          <span className="notification-avatar"><Icon name={item.icon || 'bell'} size={17} /></span>
          <span className="notification-item-copy">
            <strong>{item.title}</strong>
            <span>{item.text}</span>
            <small>{item.time || 'Earlier'}</small>
          </span>
          {!item.read && <i aria-label="Unread" className="notification-unread-dot" />}
        </button>
        {item.canReview ? (
          <button className="notification-review" onClick={() => openItem(item)} type="button">Review</button>
        ) : (
          <button className="notification-review" onClick={() => openItem(item)} type="button">View</button>
        )}
      </article>
    )
  }

  return (
    <div className="topbar-notification-anchor">
      <button
        aria-label={notificationCount > 0 ? `${title} (${notificationCount} unread)` : `Open ${title.toLowerCase()}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="icon-button notification-button"
        onClick={() => setOpenAtPath(open ? null : location.pathname)}
        ref={triggerRef}
        type="button"
      >
        <Icon className="topbar-icon" name="bell" size={20} />
        {notificationCount > 0 && (
          <span aria-label={`${notificationCount} unread`} className="notification-badge">
            {notificationCount > 99 ? '99+' : notificationCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <button aria-label={`Close ${title.toLowerCase()}`} className="notification-popover-backdrop" onClick={() => setOpenAtPath(null)} type="button" />
          <section aria-label={title} aria-modal={window.matchMedia('(max-width: 1024px)').matches} className="notification-popover" ref={dialogRef} role="dialog" tabIndex={-1}>
            <div aria-hidden="true" className="notification-sheet-handle" />
            <header className="notification-popover-header">
              <h2>{title}</h2>
              <div>
                <Link aria-label={`Open full ${title.toLowerCase()} page`} className="icon-button notification-open-page" onClick={() => setOpenAtPath(null)} to={notificationLink}>
                  <Icon name="arrow-right" size={17} />
                </Link>
                <button aria-expanded={moreOpen} aria-label="More notification options" className="icon-button notification-more" onClick={() => setMoreOpen((current) => !current)} type="button">•••</button>
                {moreOpen && <button className="notification-mark-all" onClick={() => { onMarkAllNotificationsRead(); setMoreOpen(false) }} type="button">Mark all as read</button>}
              </div>
            </header>
            <div aria-label="Notifications filter" className="notification-tabs" role="group">
              {['All', 'Unread'].map((tab) => (
                <button aria-pressed={filter === tab} className={filter === tab ? 'is-selected' : ''} key={tab} onClick={() => setFilter(tab)} type="button">{tab}</button>
              ))}
            </div>
            {notifications.length > 0 && filteredItems.length > 0 ? (
              <div className="notification-popover-list">
                {filter === 'All' ? (
                  <>
                    {filteredItems.some((item) => !item.read) && <>
                      <p className="notification-group-label">New</p>
                      {filteredItems.filter((item) => !item.read).map(renderItem)}
                    </>}
                    {filteredItems.some((item) => item.read) && <>
                      <p className="notification-group-label">Earlier</p>
                      {filteredItems.filter((item) => item.read).map(renderItem)}
                    </>}
                  </>
                ) : (
                  <>
                    <p className="notification-group-label">{filter}</p>
                    {filteredItems.map(renderItem)}
                  </>
                )}
              </div>
            ) : (
              <div className="notification-empty">
                <span aria-hidden="true">✓</span>
                <strong>You’re all caught up</strong>
                <p>{filter === 'Unread' ? 'There are no unread updates right now.' : 'New updates will appear here.'}</p>
              </div>
            )}
            <Link className="notification-popover-footer" onClick={() => setOpenAtPath(null)} to={notificationLink}>
              {role === 'Student'
                ? 'See all notifications'
                : role === 'Organization Adviser'
                  ? 'Open Approval Center'
                  : role === 'Student Affairs Admin'
                    ? 'Open Approval Center'
                    : 'View announcements'}
            </Link>
          </section>
        </>
      )}
    </div>
  )
}

export default function Navbar({
  role,
  notificationCount = 0,
  notificationLink,
  notifications = [],
  onMarkAllNotificationsRead = () => {},
  onMarkNotificationRead = () => {},
  profileLink,
  onMenuClick,
  isMenuOpen,
}) {
  const { currentUser, logout, setActiveRole } = useAuth()
  const { clearLastAction } = useToast()
  const navigate = useNavigate()
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
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

  function closeLogoutDialog() {
    setLogoutOpen(false)
    setIsLoggingOut(false)
  }

  function confirmLogout() {
    setIsLoggingOut(true)
    window.requestAnimationFrame(() => {
      clearLastAction()
      logout()
      setLogoutOpen(false)
      navigate('/login', { replace: true })
    })
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
        <NotificationPopover
          notificationCount={notificationCount}
          notificationLink={notificationLink}
          notifications={notifications}
          onMarkAllNotificationsRead={onMarkAllNotificationsRead}
          onMarkNotificationRead={onMarkNotificationRead}
          role={role}
        />
        <Link aria-label="Open profile or settings" className="icon-button profile-link" to={profileLink} title="Profile">
          <Icon className="topbar-icon" name="user" size={20} />
        </Link>
        <Button className="topbar-logout" onClick={() => setLogoutOpen(true)} variant="secondary">Logout</Button>
      </div>
      <Modal onClose={closeLogoutDialog} open={logoutOpen} title="Log out of UNIDOS?">
        <div className="logout-dialog-content">
          <span aria-hidden="true" className="logout-dialog-icon">
            <svg fill="none" viewBox="0 0 24 24"><path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10M14 16l4-4-4-4m4 4H9" /></svg>
          </span>
          <p>You'll need to sign in again to access your account.</p>
        </div>
        <div className="logout-dialog-actions">
          <Button disabled={isLoggingOut} onClick={closeLogoutDialog} variant="secondary">Cancel</Button>
          <Button aria-busy={isLoggingOut} disabled={isLoggingOut} onClick={confirmLogout}>
            {isLoggingOut ? <><span aria-hidden="true" className="logout-loading-spinner" /> Logging out…</> : 'Log out'}
          </Button>
        </div>
      </Modal>
    </header>
  )
}
