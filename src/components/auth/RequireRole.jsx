/**
 * Role-Based Route Guards
 *
 * - `RequireRole`: Protects portal routes (`/officer/*`, `/adviser/*`, `/admin/*`).
 *   Admin accounts (`isGlobalAdmin` / `ADMIN`) hold global access permissions across
 *   all modules and records. Coordinator accounts (`isCoordinator`) can also access
 *   adviser pre-generation & organization administration.
 * - `PublicOnly`: Redirects already-authenticated users to their active role's dashboard.
 */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { dashboardByRole } from '../../data/navigation.js'
import { useAuth } from '../../context/useAuth.js'

export default function RequireRole({ role }) {
  const { currentUser, authLoading } = useAuth()
  const location = useLocation()

  if (authLoading) {
    return (
      <div
        className="page-loading-state"
        style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        Loading...
      </div>
    )
  }

  if (!currentUser) return <Navigate replace state={{ from: location.pathname }} to="/login" />

  // Student entity/portal has been retired; redirect any legacy route cleanly to public directory
  if (role === 'STUDENT') {
    return <Navigate replace to="/organizations" />
  }

  // Global Admin override: full access across all system modules and portals
  const availableRoles = currentUser.roles ?? [currentUser.role]
  const isGlobalAdmin = Boolean(
    currentUser.isGlobalAdmin ||
    currentUser.role === 'ADMIN' ||
    availableRoles.includes('ADMIN')
  )
  if (isGlobalAdmin) {
    return <Outlet />
  }

  // Coordinator (Ma'am Marj) override: access Adviser portal + Admin Users/Organizations for adviser account preparation
  if (currentUser.isCoordinator && (role === 'ADVISER' || role === 'ADMIN')) {
    return <Outlet />
  }

  if (role === 'OFFICER') {
    const isOfficer = availableRoles.includes('OFFICER') || currentUser.role === 'OFFICER'
    if (!isOfficer) return <Navigate replace to="/access-denied" />
    return <Outlet />
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
    const targetDashboard = dashboardByRole[currentUser.role] ?? '/officer/dashboard'
    return <Navigate replace to={targetDashboard} />
  }
  return children
}
