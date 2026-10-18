import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import { dashboardByRole } from '../data/mockAuthUsers.js'
import Card from '../components/ui/Card.jsx'
import WmsuLogo from '../components/ui/WmsuLogo.jsx'

export default function AccessDeniedPage() {
  const { currentUser } = useAuth()
  const destination = dashboardByRole[currentUser?.role] ?? '/login'
  return (
    <Card className="access-denied-card">
      <WmsuLogo className="brand-seal" />
      <h1>Access Denied</h1>
      <p>You don't have permission to access this page.</p>
      <Link className="button button-primary" to={destination}>Go to My Dashboard</Link>
    </Card>
  )
}
