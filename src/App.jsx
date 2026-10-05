import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import RequireRole, { PublicOnly } from './components/auth/RequireRole.jsx'
import AdminLayout from './components/layout/AdminLayout.jsx'
import AdviserLayout from './components/layout/AdviserLayout.jsx'
import OfficerLayout from './components/layout/OfficerLayout.jsx'
import PublicLayout from './components/layout/PublicLayout.jsx'
import StudentLayout from './components/layout/StudentLayout.jsx'
import EventDetailsPage from './pages/EventDetailsPage.jsx'
import AdviserApprovalsPage from './pages/AdviserApprovalsPage.jsx'
import AdviserDashboardPage from './pages/AdviserDashboardPage.jsx'
import AdviserEventsPage from './pages/AdviserEventsPage.jsx'
import { AdviserOrganizationDetailsPage, AdviserOrganizationsPage } from './pages/AdviserOrganizationsPages.jsx'
import AdviserReportsPage from './pages/AdviserReportsPage.jsx'
import AdminPortalPage from './pages/AdminPortalPages.jsx'
import OfficerDashboardPage from './pages/OfficerDashboardPage.jsx'
import OfficerAnnouncementsPage from './pages/OfficerAnnouncementsPage.jsx'
import OfficerAttendancePage from './pages/OfficerAttendancePage.jsx'
import OfficerDocumentsPage from './pages/OfficerDocumentsPage.jsx'
import OfficerEventFormPage from './pages/OfficerEventFormPage.jsx'
import OfficerEventsPage from './pages/OfficerEventsPage.jsx'
import OfficerMembersPage from './pages/OfficerMembersPage.jsx'
import OfficerMembershipRequestsPage from './pages/OfficerMembershipRequestsPage.jsx'
import OfficerOrganizationProfilePage from './pages/OfficerOrganizationProfilePage.jsx'
import OfficerReportsPage from './pages/OfficerReportsPage.jsx'
import OfficerSettingsPage from './pages/OfficerSettingsPage.jsx'
import PlaceholderPage from './pages/PlaceholderPage.jsx'
import PublicPage from './pages/PublicPage.jsx'
import AccessDeniedPage from './pages/AccessDeniedPage.jsx'
import StudentDashboardPage from './pages/StudentDashboardPage.jsx'
import StudentAttendancePage from './pages/StudentAttendancePage.jsx'
import StudentEventPassPage from './pages/StudentEventPassPage.jsx'
import StudentEventsPage from './pages/StudentEventsPage.jsx'
import StudentMyOrganizationsPage from './pages/StudentMyOrganizationsPage.jsx'
import StudentOrganizationDetailsPage from './pages/StudentOrganizationDetailsPage.jsx'
import StudentOrganizationsPage from './pages/StudentOrganizationsPage.jsx'
import StudentRegistrationsPage from './pages/StudentRegistrationsPage.jsx'
import StudentNotificationsPage from './pages/StudentNotificationsPage.jsx'
import StudentProfilePage from './pages/StudentProfilePage.jsx'
import { adminPages, officerPages, studentPages } from './data/navigation.js'
import { PortalDataProvider } from './context/PortalDataContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './App.css'

const pageTitles = {
  '/': 'Student Organization Management System',
  '/login': 'Sign In',
  '/register': 'Create Account',
  '/forgot-password': 'Reset Password',
  '/access-denied': 'Access Denied',
  '/student/dashboard': 'Student Dashboard',
  '/student/organizations': 'Organizations',
  '/student/my-organizations': 'My Organizations',
  '/student/events': 'Events',
  '/student/registrations': 'My Registrations',
  '/student/attendance': 'Attendance',
  '/student/notifications': 'Notifications',
  '/student/profile': 'My Profile',
  '/officer/dashboard': 'Officer Dashboard',
  '/officer/organization': 'Organization Profile',
  '/officer/members': 'Organization Members',
  '/officer/membership-requests': 'Membership Requests',
  '/officer/events': 'Organization Events',
  '/officer/events/create': 'Create Event Proposal',
  '/officer/attendance': 'Event Attendance',
  '/officer/announcements': 'Announcements',
  '/officer/documents': 'Organization Documents',
  '/officer/reports': 'Activity Reports',
  '/officer/settings': 'Organization Settings',
  '/adviser/dashboard': 'Adviser Dashboard',
  '/adviser/organizations': 'My Organizations',
  '/adviser/approvals': 'Adviser Approvals',
  '/adviser/events': 'Organization Events',
  '/adviser/reports': 'Activity & Accomplishment Reports',
  ...Object.fromEntries(adminPages.map((page) => [`/admin/${page.path}`, page.title])),
}

function DocumentTitle() {
  const { pathname } = useLocation()
  let pageTitle = pageTitles[pathname]

  if (!pageTitle && /^\/student\/events\/[^/]+$/.test(pathname)) pageTitle = 'Event Details'
  if (!pageTitle && /^\/student\/organizations\/[^/]+$/.test(pathname)) pageTitle = 'Organization Profile'
  if (!pageTitle && /^\/student\/registrations\/[^/]+\/pass$/.test(pathname)) pageTitle = 'Event Pass'
  if (!pageTitle && /^\/adviser\/organizations\/[^/]+$/.test(pathname)) pageTitle = 'Organization Details'

  if (!pageTitle) {
    const pageKey = pathname.split('/').filter(Boolean).pop() ?? ''
    pageTitle = pageKey.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Student Organization Management System'
  }

  useEffect(() => {
    document.title = `UNIDOS | ${pageTitle}`
  }, [pageTitle])

  return null
}

function pageRoutes(pages, role) {
  return pages.map((page) => (
    <Route
      key={page.path}
      path={page.path}
      element={<PlaceholderPage page={page} role={role} />}
    />
  ))
}

function App() {
  return (
    <AuthProvider>
      <PortalDataProvider>
        <DocumentTitle />
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<PublicPage page="home" />} />
            <Route path="login" element={<PublicOnly><PublicPage page="login" /></PublicOnly>} />
            <Route path="register" element={<PublicPage page="register" />} />
            <Route path="forgot-password" element={<PublicPage page="forgot-password" />} />
            <Route path="access-denied" element={<AccessDeniedPage />} />
          </Route>

          <Route element={<RequireRole role="STUDENT" />}>
            <Route path="student" element={<StudentLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<StudentDashboardPage />} />
              <Route path="organizations" element={<StudentOrganizationsPage />} />
              <Route path="organizations/:id" element={<StudentOrganizationDetailsPage />} />
              <Route path="my-organizations" element={<StudentMyOrganizationsPage />} />
              <Route path="events" element={<StudentEventsPage />} />
              <Route path="events/:id" element={<EventDetailsPage />} />
              <Route path="registrations" element={<StudentRegistrationsPage />} />
              <Route path="registrations/:registrationId/pass" element={<StudentEventPassPage />} />
              <Route path="attendance" element={<StudentAttendancePage />} />
              <Route path="notifications" element={<StudentNotificationsPage />} />
              <Route path="profile" element={<StudentProfilePage />} />
              {pageRoutes(studentPages.filter((page) => !['dashboard', 'organizations', 'organizations/:id', 'my-organizations', 'events', 'events/:id', 'registrations', 'attendance', 'notifications', 'profile'].includes(page.path)), 'Student')}
            </Route>
          </Route>
          <Route element={<RequireRole role="OFFICER" />}>
            <Route path="officer" element={<OfficerLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<OfficerDashboardPage />} />
              <Route path="organization" element={<OfficerOrganizationProfilePage />} />
              <Route path="members" element={<OfficerMembersPage />} />
              <Route path="membership-requests" element={<OfficerMembershipRequestsPage />} />
              <Route path="events" element={<OfficerEventsPage />} />
              <Route path="events/create" element={<OfficerEventFormPage />} />
              <Route path="attendance" element={<OfficerAttendancePage />} />
              <Route path="announcements" element={<OfficerAnnouncementsPage />} />
              <Route path="settings" element={<OfficerSettingsPage />} />
              <Route path="documents" element={<OfficerDocumentsPage />} />
              <Route path="reports" element={<OfficerReportsPage />} />
              {pageRoutes(officerPages.filter((page) => !['dashboard', 'organization', 'members', 'membership-requests', 'events', 'events/create', 'attendance', 'announcements', 'documents', 'reports', 'settings'].includes(page.path)), 'Organization Officer')}
            </Route>
          </Route>
          <Route element={<RequireRole role="ADVISER" />}>
            <Route path="adviser" element={<AdviserLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdviserDashboardPage />} />
              <Route path="organizations" element={<AdviserOrganizationsPage />} />
              <Route path="organizations/:id" element={<AdviserOrganizationDetailsPage />} />
              <Route path="approvals" element={<AdviserApprovalsPage />} />
              <Route path="events" element={<AdviserEventsPage />} />
              <Route path="reports" element={<AdviserReportsPage />} />
            </Route>
          </Route>
          <Route element={<RequireRole role="ADMIN" />}>
            <Route path="admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              {adminPages.map((page) => <Route key={page.path} path={page.path} element={<AdminPortalPage key={page.path} />} />)}
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PortalDataProvider>
    </AuthProvider>
  )
}

export default App