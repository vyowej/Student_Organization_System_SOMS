/**
 * Faculty Adviser Dashboard Page (`/adviser/dashboard`)
 *
 * Summarizes assigned student organizations, pending event proposals,
 * compliance documents, and accomplishment reports awaiting adviser review.
 */
import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import Icon from '../components/ui/Icon.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { formatDisplayName } from '../data/displayName.js'

function StatCard({ label, value, to }) {
  return (
    <Link className="adviser-stat-link" to={to}>
      <Card className="adviser-stat-card">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{value}</strong>
        <small className="stat-note">View details <Icon name="arrow-right" size={13} /></small>
      </Card>
    </Link>
  )
}

export default function AdviserDashboardPage() {
  const {
    adminOrganizations = [],
    adviserActivity = [],
    adviserDocuments = [],
    adviserReports = [],
    currentUser,
    officerEvents = [],
    officerMembershipRequests = [],
  } = useOutletContext()

  const assignedOrgs = adminOrganizations.filter((org) => {
    if (currentUser?.adviserRecordId && String(org.adviserId) === String(currentUser.adviserRecordId)) return true
    if (currentUser?.advisedOrganizations?.some((a) => String(a.organization_id) === String(org.id))) return true
    return false
  })
  const effectiveOrgs = assignedOrgs.length > 0 ? assignedOrgs : adminOrganizations
  const assignedOrgIds = new Set(effectiveOrgs.map((org) => String(org.id)))

  const pendingEvents = officerEvents
    .filter((event) => !event.organizationId || assignedOrgIds.has(String(event.organizationId)))
    .filter((event) => ['SUBMITTED', 'UNDER_REVIEW', 'PENDING'].includes(event.status))
  const pendingDocuments = adviserDocuments
    .filter((document) => !document.organizationId || assignedOrgIds.has(String(document.organizationId)))
    .filter((document) => document.status === 'PENDING')
  const pendingReports = adviserReports
    .filter((report) => !report.organizationId || assignedOrgIds.has(String(report.organizationId)))
    .filter((report) => report.status === 'PENDING_VERIFICATION')
  const pendingApplications = officerMembershipRequests
    .filter((app) => !app.organizationId || assignedOrgIds.has(String(app.organizationId)))
    .filter((app) => app.status === 'PENDING')

  const approvalsCount = pendingEvents.length + pendingDocuments.length + pendingReports.length + pendingApplications.length
  const upcomingEvents = officerEvents
    .filter((event) => !event.organizationId || assignedOrgIds.has(String(event.organizationId)))
    .filter((event) => ['APPROVED', 'PUBLISHED'].includes(event.status))

  const pending = [
    ...pendingEvents.map((event) => ({ ...event, type: 'Event Proposal', title: event.title, submittedDate: event.submittedDate || event.date, to: '/adviser/events' })),
    ...pendingDocuments.map((document) => ({ ...document, type: 'Organization Document', to: '/adviser/approvals' })),
    ...pendingReports.map((report) => ({ ...report, type: 'Accomplishment Report', title: report.eventTitle, submittedDate: report.submittedDate, to: '/adviser/reports' })),
    ...pendingApplications.map((app) => ({
      ...app,
      type: 'Membership Application',
      title: `${app.name || 'Student'} — Membership Application`,
      submittedDate: app.applicationDate || 'Recently',
      to: '/adviser/approvals',
    })),
  ]

  return (
    <div className="adviser-page">
      <PageHeader
        description="Review proposals, support assigned organizations, and keep activities on track."
        eyebrow="UNIDOS · FACULTY ADVISER"
        title={`Welcome, ${formatDisplayName(currentUser) || 'Faculty Adviser'}`}
      >
        <div className="adviser-stat-grid">
          <StatCard label="Organizations Under Advisement" value={effectiveOrgs.length} to="/adviser/organizations" />
          <StatCard label="Pending Approvals" value={approvalsCount} to="/adviser/approvals" />
          <StatCard label="Scheduled Activities" value={upcomingEvents.length} to="/adviser/events" />
          <StatCard label="Verified Accomplishment Reports" value={adviserReports.filter((report) => report.status === 'VERIFIED').length} to="/adviser/reports" />
        </div>
      </PageHeader>

      <div className="adviser-dashboard-columns">
        <Card className="adviser-panel">
          <div className="adviser-panel-heading">
            <div><h2>Pending Approvals</h2><p>Recent items that require your review.</p></div>
            <Link to="/adviser/approvals">View all</Link>
          </div>
          {pending.length ? pending.slice(0, 5).map((item) => (
            <article className="adviser-list-row" key={`${item.type}-${item.id}`}>
              <div><strong>{item.title}</strong><span>{item.organizationName} · {item.type}</span><small>Submitted {item.submittedDate}</small></div>
              <Badge tone="warning">PENDING</Badge>
              <Link className="button button-secondary" to={item.to}>View</Link>
            </article>
          )) : <p className="adviser-empty-note">There are no items waiting for review.</p>}
        </Card>
        <Card className="adviser-panel">
          <div className="adviser-panel-heading">
            <div><h2>Upcoming Activities</h2><p>Approved or published events from your assigned organizations.</p></div>
            <Link to="/adviser/events">View calendar</Link>
          </div>
          {upcomingEvents.length ? upcomingEvents.slice(0, 5).map((event) => (
            <article className="adviser-list-row" key={event.id}>
              <div><strong>{event.title}</strong><span>{event.organizationName ?? effectiveOrgs.find((organization) => String(organization.id) === String(event.organizationId))?.name}</span><small>{event.date} · {event.time || event.startTime || 'Time to be confirmed'} · {event.location || event.venue || 'Venue to be confirmed'}</small></div>
              <Badge tone={event.status === 'PUBLISHED' ? 'success' : 'crimson'}>{event.status}</Badge>
              <Link className="button button-secondary" to="/adviser/events">View</Link>
            </article>
          )) : <p className="adviser-empty-note">No scheduled activities are available yet.</p>}
        </Card>
      </div>

      <Card className="adviser-panel adviser-activity-panel">
        <div className="adviser-panel-heading"><div><h2>Recent Activity</h2><p>Recent reviews and organization updates.</p></div></div>
        {adviserActivity.length ? adviserActivity.slice(0, 5).map((activity) => (
          <div className="adviser-activity-row" key={activity.id}><span aria-hidden="true">•</span><p>{activity.description || activity.message}</p><time>{activity.timestamp || activity.time}</time></div>
        )) : <p className="adviser-empty-note">No recent activity recorded yet.</p>}
      </Card>
    </div>
  )
}
