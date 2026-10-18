import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { dashboardByRole } from '../../data/mockAuthUsers.js'
import { useAuth } from '../../context/useAuth.js'

export default function RequireRole({ role }) {
  const { currentUser, setActiveRole } = useAuth()
  const location = useLocation()

  // A student who is also an officer can reach /officer/* by URL (or refresh) without
  // having picked an organization workspace, which left every officer page without
  // an organization. Activate their only organization automatically; if they have
  // several, send them to pick one.
  const needsWorkspace = role === 'OFFICER'
    && currentUser?.role !== 'OFFICER'
    && Boolean(currentUser?.roles?.includes('OFFICER'))
  const soleOrganizationId = needsWorkspace && currentUser.organizationRoles?.length === 1
    ? currentUser.organizationRoles[0].organizationId
    : null
  useEffect(() => {
    if (soleOrganizationId) setActiveRole('OFFICER', soleOrganizationId)
  }, [setActiveRole, soleOrganizationId])

  if (needsWorkspace) {
    return soleOrganizationId ? null : <Navigate replace to="/student/my-organizations" />
  }
  if (!currentUser) return <Navigate replace state={{ from: location.pathname }} to="/login" />
  const availableRoles = currentUser.roles ?? [currentUser.role]
  if (!availableRoles.includes(role)) return <Navigate replace to="/access-denied" />
  return <Outlet />
}

export function PublicOnly({ children }) {
  const { currentUser } = useAuth()
  if (currentUser) return <Navigate replace to={dashboardByRole[currentUser.role] ?? '/'} />
  return children
}
