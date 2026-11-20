import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import RequireRole, { PublicOnly } from './components/auth/RequireRole.jsx'
import { AdminLayout, AdviserLayout, OfficerLayout } from './components/layout/PortalLayout.jsx'
import PublicLayout from './components/layout/PublicLayout.jsx'
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
import PublicPage from './pages/PublicPage.jsx'
import AccessDeniedPage from './pages/AccessDeniedPage.jsx'
import NotFoundPage, { PortalNotFoundPage } from './pages/NotFoundPage.jsx'
import StudentEventsPage from './pages/StudentEventsPage.jsx'
import StudentOrganizationDetailsPage from './pages/StudentOrganizationDetailsPage.jsx'
import StudentOrganizationsPage from './pages/StudentOrganizationsPage.jsx'
import { adminPages, dashboardByRole } from './data/navigation.js'
import { PortalDataProvider } from './context/PortalDataContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { useAuth } from './context/useAuth.js'
import ErrorBoundary from './components/ui/ErrorBoundary.jsx'
import './App.css'

const pageTitles = {
  '/': 'Student Organization Management System',
  '/organizations': 'Organizations Directory',
  '/events': 'Campus Events',
  '/login': 'Sign In',
  '/register': 'Officer Account Registration',
  '/forgot-password': 'Reset Password',
  '/access-denied': 'Access Denied',
  '/officer/dashboard': 'Officer Dashboard',
  '/officer/organization': 'Organization Profile',
  '/officer/members': 'Officers & Committees',
  '/officer/membership-requests': 'Officer Applications',
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

  if (!pageTitle && /^\/events\/[^/]+$/.test(pathname)) pageTitle = 'Event Details'
  if (!pageTitle && /^\/organizations\/[^/]+$/.test(pathname)) pageTitle = 'Organization Profile'
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

function ParamRedirect({ basePath }) {
  const { id } = useParams()
  const target = id ? `${basePath}/${encodeURIComponent(id)}` : basePath
  return <Navigate replace to={target} />
}

function RoleRedirect({ target = 'dashboard' }) {
  const { currentUser, authLoading } = useAuth()
  if (authLoading) return null
  if (!currentUser) return <Navigate replace to="/login" />

  const mapByRole = {
    dashboard: dashboardByRole,
    notifications: {
      OFFICER: '/officer/announcements',
      ADVISER: '/adviser/approvals',
      ADMIN: '/admin/approvals',
    },
    profile: {
      OFFICER: '/officer/organization',
      ADVISER: '/adviser/organizations',
      ADMIN: '/admin/settings',
    },
  }
  const resolved = mapByRole[target]?.[currentUser.role] || dashboardByRole[currentUser.role] || '/organizations'
  return <Navigate replace to={resolved} />
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PortalDataProvider>
          <DocumentTitle />
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<PublicPage page="home" />} />
              <Route path="organizations" element={<StudentOrganizationsPage />} />
              <Route path="organizations/:id" element={<StudentOrganizationDetailsPage />} />
              <Route path="events" element={<StudentEventsPage />} />
              <Route path="events/:id" element={<EventDetailsPage />} />
              <Route path="login" element={<PublicOnly><PublicPage page="login" /></PublicOnly>} />
              <Route path="register" element={<PublicPage page="register" />} />
              <Route path="forgot-password" element={<PublicPage page="forgot-password" />} />
              <Route path="access-denied" element={<AccessDeniedPage />} />
              <Route path="dashboard" element={<RoleRedirect target="dashboard" />} />
              <Route path="notifications" element={<RoleRedirect target="notifications" />} />
              <Route path="profile" element={<RoleRedirect target="profile" />} />

              {/* Legacy student portal URLs preserve IDs and redirect cleanly to public directory / events */}
              <Route path="student/organizations" element={<Navigate to="/organizations" replace />} />
              <Route path="student/organizations/:id" element={<ParamRedirect basePath="/organizations" />} />
              <Route path="student/events" element={<Navigate to="/events" replace />} />
              <Route path="student/events/:id" element={<ParamRedirect basePath="/events" />} />
              <Route path="student/attendance" element={<Navigate to="/events" replace />} />
              <Route path="student/registrations" element={<Navigate to="/events" replace />} />
              <Route path="student/registrations/*" element={<Navigate to="/events" replace />} />
              <Route path="student/dashboard" element={<RoleRedirect target="dashboard" />} />
              <Route path="student/notifications" element={<RoleRedirect target="notifications" />} />
              <Route path="student/profile" element={<RoleRedirect target="profile" />} />
              <Route path="student/my-organizations" element={<Navigate to="/organizations" replace />} />
              <Route path="student/*" element={<Navigate to="/organizations" replace />} />

              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* Organization Officer portal routes */}
            <Route element={<RequireRole role="OFFICER" />}>
              <Route path="officer" element={<OfficerLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<OfficerDashboardPage />} />
                <Route path="organization" element={<OfficerOrganizationProfilePage />} />
                <Route path="organizations" element={<Navigate to="/officer/organization" replace />} />
                <Route path="profile" element={<Navigate to="/officer/organization" replace />} />
                <Route path="members" element={<OfficerMembersPage />} />
                <Route path="membership-requests" element={<OfficerMembershipRequestsPage />} />
                <Route path="events" element={<OfficerEventsPage />} />
                <Route path="events/create" element={<OfficerEventFormPage />} />
                <Route path="events/:id" element={<Navigate to="/officer/events" replace />} />
                <Route path="approvals" element={<Navigate to="/officer/events" replace />} />
                <Route path="attendance" element={<OfficerAttendancePage />} />
                <Route path="announcements" element={<OfficerAnnouncementsPage />} />
                <Route path="notifications" element={<Navigate to="/officer/announcements" replace />} />
                <Route path="settings" element={<OfficerSettingsPage />} />
                <Route path="documents" element={<OfficerDocumentsPage />} />
                <Route path="reports" element={<OfficerReportsPage />} />
                <Route path="*" element={<PortalNotFoundPage home="/officer/dashboard" portalLabel="Officer Dashboard" />} />
              </Route>
            </Route>

            {/* Faculty Adviser portal routes */}
            <Route element={<RequireRole role="ADVISER" />}>
              <Route path="adviser" element={<AdviserLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdviserDashboardPage />} />
                <Route path="organizations" element={<AdviserOrganizationsPage />} />
                <Route path="organizations/:id" element={<AdviserOrganizationDetailsPage />} />
                <Route path="profile" element={<Navigate to="/adviser/organizations" replace />} />
                <Route path="settings" element={<Navigate to="/adviser/organizations" replace />} />
                <Route path="approvals" element={<AdviserApprovalsPage />} />
                <Route path="notifications" element={<Navigate to="/adviser/approvals" replace />} />
                <Route path="events" element={<AdviserEventsPage />} />
                <Route path="reports" element={<AdviserReportsPage />} />
                <Route path="*" element={<PortalNotFoundPage home="/adviser/dashboard" portalLabel="Adviser Dashboard" />} />
              </Route>
            </Route>

            {/* Student Affairs Admin portal routes (Global Access) */}
            <Route element={<RequireRole role="ADMIN" />}>
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="students" element={<Navigate to="/admin/users" replace />} />
                <Route path="applications" element={<Navigate to="/admin/organization-applications" replace />} />
                <Route path="notifications" element={<Navigate to="/admin/approvals" replace />} />
                <Route path="profile" element={<Navigate to="/admin/settings" replace />} />
                <Route path="logs" element={<Navigate to="/admin/audit-logs" replace />} />
                <Route path="standing" element={<Navigate to="/admin/analytics" replace />} />
                {adminPages.map((page) => <Route key={page.path} path={page.path} element={<AdminPortalPage key={page.path} />} />)}
                <Route path="*" element={<PortalNotFoundPage home="/admin/dashboard" portalLabel="Admin Dashboard" />} />
              </Route>
            </Route>
          </Routes>
        </PortalDataProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
