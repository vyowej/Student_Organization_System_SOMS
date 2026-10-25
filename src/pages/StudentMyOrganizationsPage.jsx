import { useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import { studentOrganizations } from '../data/studentOrganizations.js'
import { useAuth } from '../context/useAuth.js'

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
  const { adminOrganizations = [], currentUser, studentMemberships = [] } = useOutletContext()
  const { switchRole } = useAuth()
  const navigate = useNavigate()
  const officerAssignments = currentUser?.organizationRoles ?? []
  const [search, setSearch] = useState('')

  const myMemberships = studentMemberships.filter(
    (m) =>
      (currentUser?.studentDbId && String(m.studentDbId) === String(currentUser.studentDbId)) ||
      (currentUser?.id && String(m.userId) === String(currentUser.id)) ||
      (currentUser?.studentId && String(m.studentId).toLowerCase() === String(currentUser.studentId).toLowerCase()),
  )

  function findOrganization(organizationId) {
    return adminOrganizations.find((item) => String(item.id) === String(organizationId))
      ?? studentOrganizations.find((item) => String(item.id) === String(organizationId))
  }

  function openOrganizationWorkspace(organizationId) {
    if (switchRole('OFFICER', organizationId)) {
      navigate('/officer/dashboard')
    }
  }

  return (
    <div className="student-my-organizations-page">
      <PageHeader
        description="Review your organization memberships and application statuses."
        eyebrow="UNIDOS STUDENT PORTAL"
        title="My Organizations"
      />
      <SearchBar label="Search my organizations" onChange={setSearch} placeholder="Search by organization, acronym or position…" sticky value={search} />
      {groups.map((group) => {
        const records = myMemberships
          .filter((membership) => statusContent[membership.status]?.group === group.id)
          .filter((membership) => {
            const organization = findOrganization(membership.organizationId)
            return organization && matchesQuery(search, organization.name, organization.acronym, membership.role || membership.position, membership.status)
          })
        return (
          <section aria-labelledby={`membership-group-${group.id}`} className="membership-group" key={group.id}>
            <div className="membership-group-heading">
              <h2 id={`membership-group-${group.id}`}>{group.title}</h2>
              <span>{records.length}</span>
            </div>
            {records.length ? (
              <div className="membership-list">
                {records.map((membership) => {
                  const organization = findOrganization(membership.organizationId)
                  if (!organization) return null
                  const status = statusContent[membership.status]
                  const officerPositions = officerAssignments
                    .filter((assignment) => String(assignment.organizationId) === String(organization.id))
                    .flatMap((assignment) => assignment.positions ?? (assignment.position ? [assignment.position] : []))
                    .filter((pos) => pos && !['MEMBER', 'General Member', 'Member'].includes(pos))

                  const isUserOfficer = Boolean(
                    currentUser?.roles?.includes('OFFICER') || currentUser?.role === 'OFFICER'
                  )

                  const rawPos = membership.position || membership.role
                  const displayPosition = officerPositions.length > 0
                    ? [...new Set(officerPositions)].join(', ')
                    : (!rawPos || ['MEMBER', 'Member'].includes(rawPos)
                        ? 'General Member'
                        : rawPos)

                  return (
                    <article className="membership-card" key={membership.organizationId}>
                      <div aria-hidden="true" className={`organization-directory-avatar organization-avatar-${organization.color || 'crimson'}`}>
                        {organization.acronym || organization.name.slice(0, 3).toUpperCase()}
                      </div>
                      <div className="membership-card-copy">
                        <h3>{organization.name}</h3>
                        <p>{displayPosition}</p>
                        <span>{membership.status === 'ACTIVE' ? 'Joined' : 'Applied'} {membership.approvedDate ?? membership.applicationDate}</span>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      <div className="membership-card-actions">
                        <Link className="button button-secondary membership-view-button" to={`/student/organizations/${organization.id}`}>
                          View Organization
                        </Link>
                        {membership.status === 'ACTIVE' && isUserOfficer && (
                          <button
                            className="button button-primary membership-workspace-button"
                            onClick={() => openOrganizationWorkspace(organization.id)}
                            type="button"
                          >
                            Open organization workspace
                            <span>{[...new Set(officerPositions)].join(', ') || 'Officer'}</span>
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <EmptyState description={search ? 'No memberships in this group match your search.' : group.empty} title={search ? 'No matches' : 'Nothing to show yet'} />
            )}
          </section>
        )
      })}
    </div>
  )
}
