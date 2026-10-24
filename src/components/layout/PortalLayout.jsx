/**
 * Shared Portal Layout Shell
 *
 * Wraps authenticated role portals (Student, Officer, Adviser, Admin) with
 * the top Navbar, collapsible Sidebar, UndoBar, ErrorBoundary, and role-scoped
 * React Router Outlet context.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { roleNavigation } from '../../data/navigation.js'
import { studentDashboardNotifications } from '../../data/studentDashboard.js'
import { usePortalData } from '../../context/usePortalData.js'
import { useAuth } from '../../context/useAuth.js'
import Navbar from './Navbar.jsx'
import Sidebar from './Sidebar.jsx'
import UndoBar from '../ui/UndoBar.jsx'
import ErrorBoundary from '../ui/ErrorBoundary.jsx'

export default function PortalLayout({ role }) {
  const location = useLocation()
  const sharedPortalData = usePortalData()
  const { currentUser } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const previousLocation = useRef(location.pathname)
  const [readNotificationIds, setReadNotificationIds] = useState(() =>
    studentDashboardNotifications.filter((notification) => !notification.unread).map((notification) => notification.id),
  )
  const eventRegisteredCounts = useMemo(
    () => Object.fromEntries(
      (sharedPortalData.officerEvents || []).map((event) => [event.id, event.registeredCount ?? 0]),
    ),
    [sharedPortalData.officerEvents],
  )

  const studentId = currentUser?.studentId ?? currentUser?.id
  const studentRegistrations = useMemo(() => {
    if (role !== 'Student') return sharedPortalData.studentRegistrations
    return sharedPortalData.studentRegistrations.filter(
      (registration) =>
        (studentId && String(registration.studentId).toLowerCase() === String(studentId).toLowerCase()) ||
        (currentUser?.id && String(registration.userId) === String(currentUser.id)) ||
        (currentUser?.studentDbId && String(registration.studentDbId) === String(currentUser.studentDbId)),
    )
  }, [role, sharedPortalData.studentRegistrations, studentId, currentUser])

  const navigation = roleNavigation[role]

  // While the mobile drawer is open: lock page scroll and let Escape close it.
  useEffect(() => {
    if (!menuOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const sidebar = document.getElementById('portal-sidebar')
    const firstLink = sidebar?.querySelector('a[href]')
    firstLink?.focus()

    function handleDrawerKeyDown(event) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        return
      }
      if (event.key !== 'Tab' || !sidebar) return

      const focusable = [...sidebar.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleDrawerKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleDrawerKeyDown)
      document.querySelector('.mobile-menu-button')?.focus()
    }
  }, [menuOpen])

  useEffect(() => {
    if (previousLocation.current !== location.pathname) {
      previousLocation.current = location.pathname
      setMenuOpen(false)
      window.scrollTo(0, 0)
    }
  }, [location.pathname])

  function markNotificationRead(id) {
    setReadNotificationIds((currentIds) =>
      currentIds.includes(id) ? currentIds : [...currentIds, id],
    )
    sharedPortalData.markAdminNotificationRead?.(id)
  }

  async function registerForEvent(eventId) {
    return sharedPortalData.registerStudentForEvent(eventId)
  }

  async function cancelRegistration(registrationId) {
    return sharedPortalData.cancelStudentRegistration(registrationId)
  }

  function captureUndo() {
    return sharedPortalData.captureUndo()
  }

  const outletContext = role === 'Student'
    ? {
      ...sharedPortalData,
      eventRegisteredCounts,
      markNotificationRead,
      markStudentNotificationRead: sharedPortalData.markAdminNotificationRead,
      readNotificationIds,
      registerForEvent,
      cancelRegistration,
      studentRegistrations,
      currentUser,
    }
    : role === 'Organization Officer'
      ? {
        ...sharedPortalData,
        captureUndo,
        studentRegistrations,
        currentUser,
      }
      : role === 'Organization Adviser'
        ? { ...sharedPortalData, captureUndo, currentUser }
        : role === 'Student Affairs Admin'
          ? { ...sharedPortalData, captureUndo, currentUser, studentRegistrations }
          : undefined

  const unreadNotificationCount = role === 'Student'
    ? [
        ...(sharedPortalData.studentNotifications || []).map((n) => ({
          id: n.id,
          read: Boolean(n.read),
        })),
        ...studentDashboardNotifications
          .filter((n) => !(sharedPortalData.studentNotifications || []).some((sn) => sn.id === n.id))
          .map((n) => ({
            id: n.id,
            read: !n.unread || readNotificationIds.includes(n.id),
          })),
      ].filter((n) => !n.read).length
    : role === 'Organization Officer'
      ? (sharedPortalData.officerNotifications || []).filter((n) => !n.read).length
      : role === 'Student Affairs Admin'
        ? (sharedPortalData.adminNotifications || []).filter((n) => !n.read).length
        : role === 'Organization Adviser'
          ? [
              ...(sharedPortalData.adviserDocuments || []).filter((item) => item.status === 'PENDING'),
              ...(sharedPortalData.adviserReports || []).filter((item) => item.status === 'PENDING_VERIFICATION'),
              ...(sharedPortalData.officerEvents || []).filter((item) => ['SUBMITTED', 'UNDER_REVIEW'].includes(item.status)),
            ].length
          : 0

  const topbarNotifications = role === 'Student'
    ? [
        ...(sharedPortalData.studentNotifications || []).map((notification) => ({
          ...notification,
          title: notification.title ?? notification.type ?? 'Campus update',
          text: notification.message,
          time: notification.time ?? notification.createdAt ?? 'Earlier',
          read: Boolean(notification.read),
          to: '/student/notifications',
          source: 'portal',
        })),
        ...studentDashboardNotifications.map((notification) => ({
          ...notification,
          text: notification.message,
          read: !notification.unread || readNotificationIds.includes(notification.id),
          to: notification.type === 'Registration' ? '/student/registrations' : '/student/notifications',
          source: 'dashboard',
        })),
      ]
    : role === 'Student Affairs Admin'
      ? (sharedPortalData.adminNotifications || []).map((notification) => ({
          ...notification,
          title: notification.title ?? 'Approval update',
          text: notification.message,
          time: notification.createdAt,
          to: '/admin/approvals',
          source: 'admin',
        }))
      : role === 'Organization Adviser'
        ? [
            ...(sharedPortalData.adviserDocuments || [])
              .filter((item) => item.status === 'PENDING')
              .map((item) => ({ id: item.id, title: item.title ?? item.name ?? 'Document review', text: item.description, time: item.submittedDate, read: false, to: '/adviser/approvals', source: 'adviser' })),
            ...(sharedPortalData.adviserReports || [])
              .filter((item) => item.status === 'PENDING_VERIFICATION')
              .map((item) => ({ id: item.id, title: item.title ?? item.name ?? 'Activity report', text: item.description, time: item.submittedDate, read: false, to: '/adviser/approvals', source: 'adviser' })),
            ...(sharedPortalData.officerEvents || [])
              .filter((item) => ['SUBMITTED', 'UNDER_REVIEW'].includes(item.status))
              .map((item) => ({ id: item.id, title: item.title, text: item.description, time: item.submittedDate, read: false, to: '/adviser/events', source: 'adviser' })),
          ]
        : []

  function markTopbarNotificationRead(notification) {
    if (notification.source === 'portal') sharedPortalData.markStudentNotificationRead?.(notification.id)
    if (notification.source === 'admin') sharedPortalData.markAdminNotificationRead?.(notification.id)
    if (notification.source === 'dashboard') markNotificationRead(notification.id)
  }

  function markAllTopbarNotificationsRead() {
    topbarNotifications.filter((notification) => !notification.read).forEach(markTopbarNotificationRead)
  }

  return (
    <div className={`app-shell portal-layout${menuOpen ? ' sidebar-open' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <Navbar
        isMenuOpen={menuOpen}
        notificationCount={unreadNotificationCount}
        notifications={topbarNotifications}
        notificationLink={navigation.notifications}
        onMarkAllNotificationsRead={markAllTopbarNotificationsRead}
        onMarkNotificationRead={markTopbarNotificationRead}
        onMenuClick={() => setMenuOpen((open) => !open)}
        profileLink={navigation.profile}
        role={role}
      />
      <div className="portal-body">
        {menuOpen && (
          <button
            aria-label="Close navigation menu"
            className="sidebar-backdrop"
            onClick={() => setMenuOpen(false)}
            type="button"
          />
        )}
        <Sidebar
          notificationCount={unreadNotificationCount}
          onNavigate={() => setMenuOpen(false)}
          pages={navigation.pages}
          role={role}
        />
        <main className="portal-main" id="main-content" tabIndex={-1}>
          <UndoBar />
          <ErrorBoundary>
            <Outlet context={outletContext} />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
