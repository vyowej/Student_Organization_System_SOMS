import { Link, useLocation } from 'react-router-dom'
import Card from '../components/ui/Card.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import WmsuLogo from '../components/ui/WmsuLogo.jsx'
import { useAuth } from '../context/useAuth.js'
import { dashboardByRole } from '../data/navigation.js'

export function NotFoundPage() {
  const { pathname } = useLocation()
  const { currentUser } = useAuth()
  const dashboardPath = currentUser ? (dashboardByRole[currentUser.role] || '/officer/dashboard') : null

  return (
    <Card className="access-denied-card" style={{ maxWidth: '560px', margin: '48px auto', textAlign: 'center' }}>
      <WmsuLogo className="brand-seal" />
      <h1>Page Not Found</h1>
      <p>
        We couldn&apos;t find a page matching <code>{pathname}</code>. It may have moved or been renamed.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '12px' }}>
        {dashboardPath && (
          <Link className="button button-primary" to={dashboardPath}>
            Go to My Dashboard
          </Link>
        )}
        <Link className={`button ${dashboardPath ? 'button-secondary' : 'button-primary'}`} to="/organizations">
          Browse Organizations
        </Link>
        <Link className="button button-secondary" to="/">
          Back to Home
        </Link>
      </div>
    </Card>
  )
}

export function PortalNotFoundPage({ home = '/officer/dashboard', portalLabel = 'Portal' }) {
  const { pathname } = useLocation()

  return (
    <div className="portal-page-stack">
      <PageHeader
        breadcrumbs={[
          { label: portalLabel, to: home },
          { label: 'Page Not Found' },
        ]}
        description={`No page exists at "${pathname}". Use the link below to return to your workspace.`}
        eyebrow="404 · PAGE NOT FOUND"
        title="Page Not Found"
      />
      <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          The link you followed may be outdated or mistyped.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link className="button button-primary" to={home}>
            Return to {portalLabel} Dashboard
          </Link>
          <Link className="button button-secondary" to="/organizations">
            Explore Organizations
          </Link>
        </div>
      </Card>
    </div>
  )
}

export default NotFoundPage
