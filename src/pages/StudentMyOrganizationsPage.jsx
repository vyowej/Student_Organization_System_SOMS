import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { studentOrganizations } from '../data/studentOrganizations.js'

const statusContent = {
  ACTIVE: { label: 'ACTIVE MEMBER', tone: 'success', group: 'active' },
  PENDING: { label: 'PENDING', tone: 'warning', group: 'pending' },
  REJECTED: { label: 'REJECTED', tone: 'danger', group: 'past' },
  SUSPENDED: { label: 'SUSPENDED', tone: 'danger', group: 'past' },
  INACTIVE: { label: 'INACTIVE', tone: 'neutral', group: 'past' },
}

const groups = [
  { id: 'active', title: 'Active Organizations', empty: 'You are not an active member of any organizations yet.' },
  { id: 'pending', title: 'Pending Applications', empty: 'You have no membership applications awaiting review.' },
  { id: 'past', title: 'Past/Inactive Memberships', empty: 'Rejected, suspended, and inactive memberships will appear here.' },
]

export default function StudentMyOrganizationsPage() {
  const { adminOrganizations = [], studentMemberships } = useOutletContext()

  return (
    <div className="student-my-organizations-page">
      <PageHeader
        description="Review your organization memberships and application statuses."
        eyebrow="UNIDOS STUDENT PORTAL"
        title="My Organizations"
      />
      {groups.map((group) => {
        const records = studentMemberships.filter((membership) => statusContent[membership.status]?.group === group.id)
        return (
          <section aria-labelledby={`membership-group-${group.id}`} className="membership-group" key={group.id}>
            <div className="membership-group-heading">
              <h2 id={`membership-group-${group.id}`}>{group.title}</h2>
              <span>{records.length}</span>
            </div>
            {records.length ? (
              <div className="membership-list">
                {records.map((membership) => {
                  const organization = adminOrganizations.find((item) => item.id === membership.organizationId)
                    ?? studentOrganizations.find((item) => item.id === membership.organizationId)
                  if (!organization) return null
                  const status = statusContent[membership.status]
                  return (
                    <article className="membership-card" key={membership.organizationId}>
                      <div aria-hidden="true" className={`organization-directory-avatar organization-avatar-${organization.color}`}>
                        {organization.acronym}
                      </div>
                      <div className="membership-card-copy">
                        <h3>{organization.name}</h3>
                        <p>{membership.position}</p>
                        <span>{membership.status === 'ACTIVE' ? 'Joined' : 'Applied'} {membership.approvedDate ?? membership.applicationDate}</span>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <Link className="button button-secondary membership-view-button" to={`/student/organizations/${organization.id}`}>
                        View Organization
                      </Link>
                    </article>
                  )
                })}
              </div>
            ) : (
              <EmptyState description={group.empty} title="Nothing to show yet" />
            )}
          </section>
        )
      })}
    </div>
  )
}
