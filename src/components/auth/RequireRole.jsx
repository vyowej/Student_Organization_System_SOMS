import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { dashboardByRole } from '../../data/mockAuthUsers.js'
import { useAuth } from '../../context/useAuth.js'

export default function RequireRole({ role }) {
  const { currentUser } = useAuth()
  const location = useLocation()
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
