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
  const [readNotificationIds, setReadNotificationIds] = useState([])

  const eventRegisteredCounts = useMemo(
    () =>
      Object.fromEntries(
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
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
      window.scrollTo(0, 0)
    }
  }, [location.pathname])

  function markNotificationRead(id) {
    setReadNotificationIds((currentIds) =>
      currentIds.includes(id) ? currentIds : [...currentIds, id],
    )
    sharedPortalData.markNotificationRead?.(id)
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

  const outletContext = {
    ...sharedPortalData,
    captureUndo,
    eventRegisteredCounts,
    markNotificationRead,
    markStudentNotificationRead: sharedPortalData.markNotificationRead,
    markAllNotificationsRead: sharedPortalData.markAllNotificationsRead,
    readNotificationIds,
    registerForEvent,
    cancelRegistration,
    studentRegistrations,
    currentUser,
  }

  const currentNotifications = role === 'Student'
    ? sharedPortalData.studentNotifications
    : role === 'Organization Officer'
      ? sharedPortalData.officerNotifications
      : role === 'Organization Adviser'
        ? sharedPortalData.adviserNotifications
        : sharedPortalData.adminNotifications

  const roleNotifications = useMemo(() => {
    return (currentNotifications || []).map((n) => {
      const rawType = String(n.rawType || n.type || '').toUpperCase()
      const isApprovalItem = ['APPROVAL', 'APPLICATION', 'PROPOSAL', 'ACCREDITATION', 'CHANGE_REQUEST'].some((t) => rawType.includes(t))

      let destination = navigation.notifications
      let canReview = false

      if (rawType.includes('EVENT') && !rawType.includes('REGISTRATION')) {
        destination = role === 'Student Affairs Admin'
          ? '/admin/events'
          : role === 'Organization Adviser'
            ? '/adviser/events'
            : role === 'Organization Officer'
              ? '/officer/events'
              : '/student/events'
      } else if (rawType.includes('ANNOUNCEMENT')) {
        destination = role === 'Organization Officer'
          ? '/officer/announcements'
          : role === 'Student'
            ? '/student/dashboard'
            : role === 'Organization Adviser'
              ? '/adviser/dashboard'
              : '/admin/dashboard'
      } else if (rawType.includes('REGISTRATION')) {
        destination = role === 'Student'
          ? '/student/registrations'
          : role === 'Organization Officer'
            ? '/officer/attendance'
            : role === 'Organization Adviser'
              ? '/adviser/events'
              : '/admin/events'
      } else if (rawType.includes('ATTENDANCE')) {
        destination = role === 'Student'
          ? '/student/attendance'
          : role === 'Organization Officer'
            ? '/officer/attendance'
            : role === 'Organization Adviser'
              ? '/adviser/events'
              : '/admin/events'
      } else if (rawType.includes('MEMBERSHIP')) {
        destination = role === 'Organization Officer'
          ? '/officer/membership-requests'
          : role === 'Student'
            ? '/student/my-organizations'
            : role === 'Organization Adviser'
              ? '/adviser/organizations'
              : '/admin/students'
      } else if (rawType.includes('DOCUMENT')) {
        destination = role === 'Organization Officer'
          ? '/officer/documents'
          : role === 'Organization Adviser'
            ? '/adviser/approvals'
            : '/admin/approvals'
        if (role === 'Organization Adviser' || role === 'Student Affairs Admin') {
          canReview = true
        }
      } else if (rawType.includes('ADVISER')) {
        destination = role === 'Organization Adviser'
          ? '/adviser/organizations'
          : role === 'Organization Officer'
            ? '/officer/organization'
            : '/admin/approvals'
      } else if (rawType.includes('CONFIRMATION')) {
        destination = role === 'Organization Officer'
          ? (rawType.includes('DOC') ? '/officer/documents' : '/officer/events')
          : navigation.notifications
      } else if (isApprovalItem) {
        if (role === 'Student Affairs Admin') {
          destination = '/admin/approvals'
          canReview = true
        } else if (role === 'Organization Adviser') {
          destination = '/adviser/approvals'
          canReview = true
        } else if (role === 'Organization Officer') {
          destination = '/officer/events'
        } else {
          destination = '/student/my-organizations'
        }
      }

      return {
        id: n.id,
        source: 'db',
        title: n.title || n.type || 'Notification',
        text: n.message,
        time: n.createdAt || n.time || 'Recently',
        read: Boolean(n.read) || readNotificationIds.includes(n.id),
        icon: n.icon || (rawType.includes('EVENT') ? 'calendar' : isApprovalItem ? 'check' : 'bell'),
        type: n.type,
        rawType,
        canReview,
        to: destination,
      }
    })
  }, [currentNotifications, navigation.notifications, readNotificationIds, role])

  const unreadNotificationCount = roleNotifications.filter((n) => !n.read).length

  return (
    <div className={`app-shell portal-layout${menuOpen ? ' sidebar-open' : ''}`}>
      <Navbar
        isMenuOpen={menuOpen}
        notificationCount={unreadNotificationCount}
        notificationLink={navigation.notifications}
        notifications={roleNotifications}
        onMarkAllNotificationsRead={() => sharedPortalData.markAllNotificationsRead?.()}
        onMarkNotificationRead={(item) => markNotificationRead(item.id)}
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

export function AdminLayout() {
  return <PortalLayout role="Student Affairs Admin" />
}

export function AdviserLayout() {
  return <PortalLayout role="Organization Adviser" />
}

export function OfficerLayout() {
  return <PortalLayout role="Organization Officer" />
}

export function StudentLayout() {
  return <PortalLayout role="Student" />
}
