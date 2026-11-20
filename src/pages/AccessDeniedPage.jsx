import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import Card from '../components/ui/Card.jsx'
import WmsuLogo from '../components/ui/WmsuLogo.jsx'

export default function AccessDeniedPage() {
  const { currentUser } = useAuth()
  const hasOfficerWorkspace = (currentUser?.organizationRoles && currentUser.organizationRoles.length > 0) || Boolean(currentUser?.organizationId)

  let destination = '/login'
  let buttonLabel = 'Sign In'
  if (currentUser) {
    if (currentUser.role === 'ADMIN') {
      destination = '/admin/dashboard'
      buttonLabel = 'Go to My Dashboard'
    } else if (currentUser.role === 'ADVISER') {
      destination = '/adviser/dashboard'
      buttonLabel = 'Go to My Dashboard'
    } else if (currentUser.role === 'OFFICER' && hasOfficerWorkspace) {
      destination = '/officer/dashboard'
      buttonLabel = 'Go to My Dashboard'
    } else {
      destination = '/organizations'
      buttonLabel = 'Browse Organizations'
    }
  }

  return (
    <Card className="access-denied-card">
      <WmsuLogo className="brand-seal" />
      <h1>Access Denied</h1>
      <p>You don't have permission to access this page.</p>
      <Link className="button button-primary" to={destination}>
        {buttonLabel}
      </Link>
    </Card>
  )
}
