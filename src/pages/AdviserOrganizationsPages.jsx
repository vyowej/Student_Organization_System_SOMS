import { useState } from 'react'
import { Link, useParams, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import { adviserAssignedOrganizations } from '../data/adviserPortal.js'
import { formatDisplayName } from '../data/displayName.js'

function adviserInitials(name = '') {
  const words = name.replace(/^(dr|prof|engr|mr|ms|mrs|atty)\.?\s+/i, '').split(/\s+/).filter(Boolean)
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'FA'
}

export function AdviserOrganizationsPage() {
  const { adminOrganizations, officerEvents, officerMemberCount } = useOutletContext()
  const [search, setSearch] = useState('')
  const assigned = adviserAssignedOrganizations
    .map((item) => ({ ...item, ...adminOrganizations.find((entry) => entry.id === item.id) }))
    .filter((item) => matchesQuery(search, item.name, item.acronym, item.category, item.adviser))

  return (
    <>
      <PageHeader
        description="View the organizations assigned to you and their current activities."
        eyebrow="UNIDOS · FACULTY ADVISER"
        title="My Organizations"
      />
      <SearchBar label="Search organizations" onChange={setSearch} placeholder="Search by name, acronym or category…" value={search} />
      {assigned.length === 0 && <EmptyState description="No assigned organizations match your search." title="No organizations found" />}
      <div className="adviser-organization-grid">
        {assigned.map((organization) => {
          const events = officerEvents.filter((event) => event.organizationId === organization.id)
          return (
            <Card className="adviser-organization-card" key={organization.id}>
              <div className="adviser-org-card-top">
                <span className="adviser-org-logo">{organization.acronym}</span>
                <Badge tone="success">{organization.status}</Badge>
              </div>
              <span className="adviser-muted-label">{organization.category}</span>
              <h2>{organization.name}</h2>
              <p className="adviser-org-acronym">{organization.acronym}</p>
              <div className="adviser-org-adviser">
                <span aria-hidden="true">{adviserInitials(organization.adviser)}</span>
                <div><small>Faculty adviser</small><strong>{organization.adviser}</strong></div>
              </div>
              <div className="adviser-org-facts">
                <span><strong>{officerMemberCount}</strong> Members</span>
                <span><strong>{events.filter((event) => ['APPROVED', 'PUBLISHED'].includes(event.status)).length}</strong> Upcoming events</span>
              </div>
              <Link className="button button-primary" to={`/adviser/organizations/${organization.id}`}>View Organization</Link>
            </Card>
          )
        })}
      </div>
    </>
  )
}

export function AdviserOrganizationDetailsPage() {
  const { id } = useParams()
  const { adminOrganizations, adviserActivity, adviserDocuments, officerEvents, officerMemberCount, officerMembers } = useOutletContext()
  const assignedOrganization = adviserAssignedOrganizations.find((item) => item.id === id)
  const organization = assignedOrganization
    ? { ...assignedOrganization, ...adminOrganizations.find((item) => item.id === id) }
    : null

  if (!organization) {
    return (
      <>
        <PageHeader eyebrow="UNIDOS · FACULTY ADVISER" title="Organization not found" />
        <EmptyState description="This organization is not assigned to your adviser account." title="No access to organization" />
      </>
    )
  }

  const members = officerMembers.filter((member) => member.organizationId === id && member.status === 'ACTIVE')
  const officers = members.filter((member) => member.position !== 'General Member')
  const generalMembers = members.filter((member) => member.position === 'General Member')
  const events = officerEvents.filter((event) => event.organizationId === id)
  const documents = adviserDocuments.filter((document) => document.organizationId === id)

  return (
    <div className="adviser-page">
      <PageHeader
        description={`${organization.acronym} · ${organization.category} · ${organization.status}`}
        eyebrow="MY ORGANIZATIONS"
        title={organization.name}
      />
      <Card className="adviser-profile-card">
        <span className="adviser-org-logo">{organization.acronym}</span>
        <div>
          <Badge tone="success">{organization.status}</Badge>
          <p>{organization.name} is assigned to you for faculty guidance and proposal review.</p>
        </div>
        <div className="adviser-profile-meta">
          <span className="adviser-profile-count"><strong>{officerMemberCount}</strong> active members</span>
          <div className="adviser-org-adviser">
            <span aria-hidden="true">{adviserInitials(organization.adviser)}</span>
            <div><small>Faculty adviser</small><strong>{organization.adviser}</strong></div>
          </div>
        </div>
      </Card>
      <section aria-label="Mission and vision" className="adviser-purpose-grid">
        <Card className="adviser-purpose-card"><h2>Mission</h2><p>{organization.mission}</p></Card>
        <Card className="adviser-purpose-card"><h2>Vision</h2><p>{organization.vision}</p></Card>
      </section>
      <div className="adviser-detail-grid">
        <Card className="adviser-panel adviser-detail-wide">
          <h2>Officers</h2>
          {officers.length ? <div className="adviser-people-list">{officers.map((member) => <div key={member.id}><strong>{formatDisplayName(member)}</strong><Badge tone="crimson">{member.position}</Badge></div>)}</div> : <p>No active officers are recorded.</p>}
        </Card>
        <Card className="adviser-panel adviser-detail-wide">
          <h2>General Members</h2>
          {generalMembers.length ? <div className="adviser-people-list">{generalMembers.map((member) => <div key={member.id}><strong>{formatDisplayName(member)}</strong><span>{member.studentId} · {member.program}</span></div>)}</div> : <p>No active general members are recorded.</p>}
          <small>{generalMembers.length} visible members of {officerMemberCount} active members</small>
        </Card>
        <Card className="adviser-panel">
          <h2>Official Documents</h2>
          <ul className="adviser-simple-list">
            {organization.documents.map((name) => <li key={name}>{name} <Badge tone="success">On file</Badge></li>)}
            {documents.map((document) => <li key={document.id}>{document.title} <Badge tone={document.status === 'APPROVED' ? 'success' : document.status === 'PENDING' ? 'warning' : 'neutral'}>{document.status}</Badge></li>)}
          </ul>
        </Card>
        <Card className="adviser-panel adviser-detail-wide">
          <h2>Calendar of Events</h2>
          {events.length ? <div className="adviser-people-list">{events.map((event) => <div key={event.id}><strong>{event.title}</strong><span>{event.date} · {event.time || event.startTime || 'Time not set'} · {event.location || 'Venue not set'}</span><Badge tone={event.status === 'APPROVED' || event.status === 'PUBLISHED' ? 'success' : 'warning'}>{event.status}</Badge></div>)}</div> : <p>No events have been submitted.</p>}
        </Card>
        <Card className="adviser-panel">
          <h2>Announcements</h2>
          <ul className="adviser-simple-list">{(organization.announcements ?? []).filter((announcement) => !announcement.status || announcement.status === 'PUBLISHED').map((announcement) => <li key={announcement.id ?? announcement.title}><span>{announcement.title}<small>{announcement.datePosted ?? announcement.date}</small></span></li>)}</ul>
        </Card>
        <Card className="adviser-panel">
          <h2>Activity Log</h2>
          <ul className="adviser-simple-list">{adviserActivity.slice(0, 4).map((activity) => <li key={activity.id}><span>{activity.message}<small>{activity.time}</small></span></li>)}</ul>
        </Card>
      </div>
      <Link className="button button-secondary adviser-back-link" to="/adviser/organizations">Back to My Organizations</Link>
    </div>
  )
}
