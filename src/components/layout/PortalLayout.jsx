import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { roleNavigation } from '../../data/navigation.js'
import { studentDashboardNotifications } from '../../data/studentDashboard.js'
import { initialStudentRegistrations, studentEvents } from '../../data/studentEvents.js'
import { usePortalData } from '../../context/usePortalData.js'
import { useAuth } from '../../context/useAuth.js'
import Navbar from './Navbar.jsx'
import Sidebar from './Sidebar.jsx'

export default function PortalLayout({ role }) {
  const sharedPortalData = usePortalData()
  const { currentUser } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState(() =>
    studentDashboardNotifications.filter((notification) => !notification.unread).map((notification) => notification.id),
  )
  const [studentRegistrations, setStudentRegistrations] = useState(initialStudentRegistrations)
  const [eventRegisteredCounts, setEventRegisteredCounts] = useState(() =>
    Object.fromEntries(studentEvents.map((event) => [event.id, event.registeredCount])),
  )
  const navigation = roleNavigation[role]

  function markNotificationRead(id) {
    setReadNotificationIds((currentIds) => (
      currentIds.includes(id) ? currentIds : [...currentIds, id]
    ))
  }

  function registerForEvent(eventId) {
    const existingRegistration = studentRegistrations.find((registration) => (
      registration.eventId === eventId && registration.status === 'REGISTERED'
    ))
    if (existingRegistration) return existingRegistration

    const registrationDate = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date())
    const registrationNumber = String(Date.now()).slice(-6)
    const registration = {
      id: `UNIDOS-REG-${registrationNumber}`,
      eventId,
      studentId: currentUser?.studentId ?? currentUser?.id ?? 'WMSU-2026-0142',
      registrationDate,
      status: 'REGISTERED',
      attendanceStatus: 'PENDING',
      checkInTime: null,
    }

    setStudentRegistrations((currentRegistrations) => [...currentRegistrations, registration])
    setEventRegisteredCounts((currentCounts) => ({
      ...currentCounts,
      [eventId]: (currentCounts[eventId] ?? 0) + 1,
    }))
    return registration
  }

  const outletContext = role === 'Student'
    ? {
      ...sharedPortalData,
      eventRegisteredCounts,
      markNotificationRead,
      markStudentNotificationRead: sharedPortalData.markStudentNotificationRead,
      readNotificationIds,
      registerForEvent,
      studentRegistrations,
      currentUser,
    }
    : role === 'Organization Officer'
      ? {
        ...sharedPortalData,
        studentRegistrations,
          currentUser,
        }
      : role === 'Organization Adviser'
          ? { ...sharedPortalData, currentUser }
        : role === 'Student Affairs Admin'
            ? { ...sharedPortalData, currentUser, studentRegistrations }
          : undefined

  return (
    <div className={`app-shell portal-layout${menuOpen ? ' sidebar-open' : ''}`}>
      <Navbar
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
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  )
}
