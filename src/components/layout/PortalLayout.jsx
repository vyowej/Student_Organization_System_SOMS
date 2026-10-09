import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { roleNavigation } from '../../data/navigation.js'
import { studentDashboardNotifications } from '../../data/studentDashboard.js'
import { studentEvents } from '../../data/studentEvents.js'
import { usePortalData } from '../../context/usePortalData.js'
import { useAuth } from '../../context/useAuth.js'
import Navbar from './Navbar.jsx'
import Sidebar from './Sidebar.jsx'
import UndoBar from '../ui/UndoBar.jsx'

export default function PortalLayout({ role }) {
  const sharedPortalData = usePortalData()
  const { currentUser } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState(() =>
    studentDashboardNotifications.filter((notification) => !notification.unread).map((notification) => notification.id),
  )
  const [eventRegisteredCounts, setEventRegisteredCounts] = useState(() =>
    Object.fromEntries(studentEvents.map((event) => [event.id, event.registeredCount])),
  )
  const studentId = currentUser?.studentId ?? currentUser?.id
  const studentRegistrations = role === 'Student'
    ? sharedPortalData.studentRegistrations.filter((registration) => registration.studentId === studentId)
    : sharedPortalData.studentRegistrations
  const navigation = roleNavigation[role]

  // While the mobile drawer is open: lock page scroll and let Escape close it.
  useEffect(() => {
    if (!menuOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event) => { if (event.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  function markNotificationRead(id) {
    setReadNotificationIds((currentIds) => (
      currentIds.includes(id) ? currentIds : [...currentIds, id]
    ))
  }

  function registerForEvent(eventId) {
    const currentRegisteredCount = eventRegisteredCounts[eventId]
      ?? sharedPortalData.officerEvents.find((event) => event.id === eventId)?.registrations
      ?? 0
    const registration = sharedPortalData.registerStudentForEvent(
      eventId,
      currentRegisteredCount,
    )
    if (registration && !studentRegistrations.some((item) => item.id === registration.id)) {
      setEventRegisteredCounts((currentCounts) => ({
        ...currentCounts,
        [eventId]: currentRegisteredCount + 1,
      }))
    }
    return registration
  }

  function cancelRegistration(registrationId) {
    const cancelled = sharedPortalData.cancelStudentRegistration(registrationId)
    if (cancelled) {
      setEventRegisteredCounts((currentCounts) => ({
        ...currentCounts,
        [cancelled.eventId]: Math.max(0, (currentCounts[cancelled.eventId] ?? 1) - 1),
      }))
    }
    return cancelled
  }

  // Undo must also restore the per-event registration counts kept in this layout.
  function captureUndo() {
    const restoreSharedData = sharedPortalData.captureUndo()
    const countsSnapshot = eventRegisteredCounts
    return function undo() {
      restoreSharedData()
      setEventRegisteredCounts(countsSnapshot)
    }
  }

  const outletContext = role === 'Student'
    ? {
      ...sharedPortalData,
      eventRegisteredCounts,
      markNotificationRead,
      markStudentNotificationRead: sharedPortalData.markStudentNotificationRead,
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

  return (
    <div className={`app-shell portal-layout${menuOpen ? ' sidebar-open' : ''}`}>
      <Navbar
        isMenuOpen={menuOpen}
        notificationLink={navigation.notifications}
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
        <Sidebar onNavigate={() => setMenuOpen(false)} pages={navigation.pages} role={role} />
        <main className="portal-main">
          <UndoBar />
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  )
}
