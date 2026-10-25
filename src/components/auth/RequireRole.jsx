/**
 * Role-Based Route Guards
 *
 * - `RequireRole`: Protects portal routes (`/student/*`, `/officer/*`, `/adviser/*`, `/admin/*`)
 *   by verifying authentication and role membership.
 * - `PublicOnly`: Redirects already-authenticated users to their active role's dashboard.
 */
import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { dashboardByRole } from '../../data/mockAuthUsers.js'
import { useAuth } from '../../context/useAuth.js'

export default function RequireRole({ role }) {
  const { currentUser, authLoading, setActiveRole } = useAuth()
  const location = useLocation()

  if (authLoading) {
    return <div className="page-loading-state" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
  }

  if (!currentUser) return <Navigate replace state={{ from: location.pathname }} to="/login" />

  const availableRoles = currentUser.roles ?? [currentUser.role]

  // Student portal access: any user with STUDENT capability, or an officer (since every officer is a student)
  if (role === 'STUDENT') {
    const canAccessStudent = availableRoles.includes('STUDENT') ||
      currentUser?.role === 'STUDENT' ||
      currentUser?.role === 'OFFICER' ||
      Boolean(currentUser?.studentNumber || currentUser?.studentId || currentUser?.studentDbId)
    if (!canAccessStudent) return <Navigate replace to="/access-denied" />
    return <Outlet />
  }

  // Officer portal access: requires OFFICER role AND an active organization workspace
  if (role === 'OFFICER') {
    const hasOrg = (currentUser?.organizationRoles && currentUser.organizationRoles.length > 0) ||
      Boolean(currentUser?.organizationId) ||
      (currentUser?.memberships && currentUser.memberships.some((m) => m.status === 'ACTIVE' && m.position !== 'MEMBER'))

    const isOfficer = availableRoles.includes('OFFICER') || currentUser?.role === 'OFFICER'

    if (!isOfficer || !hasOrg) {
      // An officer without an assigned organization cannot enter the organization portal,
      // but CAN enter the student portal! Redirect them safely to My Organizations in the Student portal.
      return <Navigate replace to="/student/my-organizations" state={{ notice: 'No active organization workspace assigned to your account yet.' }} />
    }

    // Auto-activate single organization if coming in with role STUDENT
    if (currentUser?.role !== 'OFFICER') {
      const soleOrgId = currentUser?.organizationRoles?.length === 1
        ? currentUser.organizationRoles[0].organizationId
        : currentUser?.organizationId
      if (soleOrgId) {
        setActiveRole('OFFICER', soleOrgId)
      } else if (!currentUser?.organizationId) {
        return <Navigate replace to="/student/my-organizations" />
      }
    }
  }

  if (!availableRoles.includes(role)) return <Navigate replace to="/access-denied" />
  return <Outlet />
}

export function PublicOnly({ children }) {
  const { currentUser, authLoading } = useAuth()
  if (authLoading) {
    return null
  }
  if (currentUser) {
    const hasOrg = (currentUser.organizationRoles && currentUser.organizationRoles.length > 0) || Boolean(currentUser.organizationId)
    const targetDashboard = (currentUser.role === 'OFFICER' && !hasOrg)
      ? '/student/dashboard'
      : (dashboardByRole[currentUser.role] ?? '/student/dashboard')
    return <Navigate replace to={targetDashboard} />
  }
  return children
}
