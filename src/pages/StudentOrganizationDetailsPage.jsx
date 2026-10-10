import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'
import { getOrganizationEvents, studentOrganizations } from '../data/studentOrganizations.js'
import { formatDisplayName } from '../data/displayName.js'

const statusLabels = {
  NOT_MEMBER: 'NOT A MEMBER',
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE MEMBER',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
  INACTIVE: 'INACTIVE',
}

function MembershipBadge({ status }) {
  const tone = status === 'ACTIVE' ? 'success'
    : status === 'PENDING' ? 'warning'
      : status === 'REJECTED' || status === 'SUSPENDED' ? 'danger'
        : 'neutral'

  return <Badge className={`membership-status membership-status-${status.toLowerCase()}`} tone={tone}>{statusLabels[status]}</Badge>
}

export default function StudentOrganizationDetailsPage() {
  const { id } = useParams()
  const { adminOrganizations = [], captureUndo, officerMembers, studentMemberships, submitMembershipApplication } = useOutletContext()
  const { showToast } = useToast()
  const [applicationOpen, setApplicationOpen] = useState(false)
  const managedOrganization = adminOrganizations.find((item) => item.id === id)
  const organization = managedOrganization
    ? managedOrganization.status === 'ACTIVE' ? managedOrganization : null
    : studentOrganizations.find((item) => item.id === id)
  const membership = studentMemberships.find((item) => item.organizationId === id)
  const status = membership?.status ?? 'NOT_MEMBER'

  if (!organization) {
    return (
      <div className="student-page">
        <PageHeader eyebrow="UNIDOS STUDENT PORTAL" title="Organization not found" />
        <Card className="organization-not-found">
          <p>We could not find that organization in the current preview.</p>
          <Link className="button button-primary" to="/student/organizations">Browse Organizations</Link>
        </Card>
      </div>
    )
  }

  const events = getOrganizationEvents(organization)
  const visibleOfficers = organization.id === 'computer-society'
    ? officerMembers
      .filter((member) => member.status === 'ACTIVE' && member.position !== 'General Member' && member.position !== 'Committee Head')
      .map((member) => ({ name: formatDisplayName(member), position: member.position }))
    : organization.officers
  const publishedAnnouncements = (organization.announcements ?? []).filter((announcement) => (
    !announcement.status || announcement.status === 'PUBLISHED'
  ))
  const canApply = status === 'NOT_MEMBER' || status === 'REJECTED' || status === 'INACTIVE'
  const joinButtonLabel = status === 'ACTIVE' ? 'Member ✓'
    : status === 'PENDING' ? 'Application Pending'
      : status === 'REJECTED' ? 'Application Rejected'
        : status === 'SUSPENDED' ? 'Membership Suspended'
          : 'Join Organization'

  function confirmApplication() {
    const undo = captureUndo()
    submitMembershipApplication(organization.id)
    setApplicationOpen(false)
    showToast('Membership application submitted.', 'success', undoAction(undo))
  }

  return (
    <div className="student-organization-details">
      <PageHeader
        description="Organization profile, membership information, and campus updates."
        eyebrow="UNIDOS STUDENT PORTAL · ORGANIZATION PROFILE"
        title={organization.name}
      />

      <Card className="organization-profile-header">
        <div aria-hidden="true" className={`organization-profile-avatar organization-avatar-${organization.color}`}>{organization.logo ? <img alt="" src={organization.logo} /> : organization.acronym}</div>
        <div className="organization-profile-heading">
          <div className="organization-profile-title-line">
            <div>
              <span className="organization-profile-acronym">{organization.acronym}</span>
              <h2>{organization.name}</h2>
            </div>
            <Badge tone="crimson">{organization.category}</Badge>
          </div>
          <p>{organization.description}</p>
          <div className="organization-profile-status">
            <MembershipBadge status={status} />
            <span>{organization.activeMembers} active members</span>
          </div>
        </div>
        <div className="organization-join-area">
          <Button
            className="organization-join-button"
            disabled={!canApply}
            onClick={() => setApplicationOpen(true)}
          >
            {joinButtonLabel}
          </Button>
          {status === 'PENDING' && <p>Your application is awaiting review.</p>}
          {status === 'ACTIVE' && <p>You are an active member of this organization.</p>}
          {status === 'REJECTED' && <p>Your previous application was not approved. Select the button to submit a new application.</p>}
        </div>
      </Card>

      <div className="organization-details-grid">
        <Card className="organization-detail-panel">
          <h2>About the Organization</h2>
          <div className="organization-about-copy">
            <div><h3>Mission</h3><p>{organization.mission}</p></div>
            <div><h3>Vision</h3><p>{organization.vision}</p></div>
            <div><h3>Faculty Adviser</h3><p>{organization.adviser}</p></div>
          </div>
        </Card>

        <Card className="organization-detail-panel organization-officers-panel">
          <h2>Organization Officers</h2>
          <div className="organization-officer-list">
            {visibleOfficers.map((officer) => (
              <div className="organization-officer-row" key={officer.position}>
                <span aria-hidden="true" className="organization-officer-avatar">{officer.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
                <span><strong>{officer.name}</strong><small>{officer.position}</small></span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="organization-detail-panel">
          <h2>Recent Announcements</h2>
          <div className="organization-announcement-list">
            {publishedAnnouncements.map((announcement) => (
              <article className="organization-announcement" key={announcement.id ?? announcement.title}>
                <span aria-hidden="true" className="organization-announcement-mark">i</span>
                <div><h3>{announcement.title}</h3><time>{announcement.datePosted ?? announcement.date}</time><p>{announcement.content ?? announcement.description}</p></div>
              </article>
            ))}
            {!publishedAnnouncements.length && <EmptyState description="This organization has not published any announcements yet." title="No recent announcements" />}
          </div>
        </Card>

        <Card className="organization-detail-panel">
          <h2>Upcoming Events</h2>
          {events.length ? (
            <div className="organization-event-list">
              {events.map((event) => (
                <Link className="organization-event-link" key={event.id} to={`/student/events/${event.id}`}>
                  <span><strong>{event.title}</strong><small>{event.date} · {event.time}</small></span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState description="Check back for upcoming activities from this organization." title="No upcoming events" />
          )}
        </Card>

        <Card className="organization-detail-panel organization-documents-panel">
          <h2>Public Documents</h2>
          <div className="organization-document-list">
            {organization.documents.map((document) => (
              <div className="organization-document-row" key={document}>
                <span aria-hidden="true" className="organization-document-icon">▤</span>
                <span><strong>{document}</strong><small>Available for student viewing</small></span>
                <Badge>Public</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal
        onClose={() => setApplicationOpen(false)}
        open={applicationOpen}
        title={`Join ${organization.name}?`}
      >
        <p>Submit your membership application to this organization?</p>
        <div className="organization-application-actions">
          <Button onClick={() => setApplicationOpen(false)} variant="secondary">Cancel</Button>
          <Button onClick={confirmApplication}>Submit Application</Button>
        </div>
      </Modal>
    </div>
  )
}
