import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Modal from '../components/ui/Modal.jsx'
import ProfileCover from '../components/layout/ProfileCover.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'
import Icon from '../components/ui/Icon.jsx'
import { getOrganizationEvents, studentOrganizations } from '../data/studentOrganizations.js'

const statusLabels = {
  NOT_MEMBER: 'NOT A MEMBER',
  PENDING: 'PENDING REVIEW',
  ACTIVE: 'ACTIVE MEMBER',
  REJECTED: 'APPLICATION REJECTED',
  SUSPENDED: 'SUSPENDED',
  INACTIVE: 'INACTIVE',
}

function MembershipBadge({ status }) {
  const tone = status === 'ACTIVE' ? 'success'
    : status === 'PENDING' ? 'warning'
      : status === 'REJECTED' || status === 'SUSPENDED' ? 'danger'
        : 'neutral'

  return (
    <Badge className={`membership-status membership-status-${status.toLowerCase()}`} tone={tone}>
      {statusLabels[status] ?? status}
    </Badge>
  )
}

function getInitials(name = '') {
  return name
    .split(/[ ,]+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'O'
}

function parseEventDate(dateStr = '') {
  const parsed = dateStr ? new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`) : null
  if (parsed && !Number.isNaN(parsed.getTime())) {
    return {
      month: parsed.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
      day: String(parsed.getDate()),
    }
  }
  const parts = dateStr.split(' ')
  if (parts.length >= 2) {
    const month = parts[0].slice(0, 3).toUpperCase()
    const day = parts[1].replace(',', '')
    return { month, day }
  }
  return { month: 'EVT', day: '•' }
}

export default function StudentOrganizationDetailsPage() {
  const { id } = useParams()
  const {
    adminOrganizations = [],
    studentOrganizations: contextStudentOrganizations = [],
    officerEvents = [],
    adviserDocuments = [],
    captureUndo,
    getMembershipForOrganization,
    submitMembershipApplication,
  } = useOutletContext()
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState('overview')
  const [applicationOpen, setApplicationOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)

  const managedOrganization = adminOrganizations.find((item) => String(item.id) === String(id))
    ?? contextStudentOrganizations.find((item) => String(item.id) === String(id))
  const organization = managedOrganization
    ? managedOrganization.status === 'ACTIVE' ? managedOrganization : null
    : studentOrganizations.find((item) => String(item.id) === String(id))
  const membership = getMembershipForOrganization ? getMembershipForOrganization(id) : null
  const status = membership?.status ?? 'NOT_MEMBER'

  if (!organization) {
    return (
      <div className="student-page">
        <div className="student-org-top-nav">
          <Link className="student-org-back-link" to="/student/organizations">
            <Icon name="arrow-left" size={14} /> Back to Organizations
          </Link>
        </div>
        <Card className="organization-not-found" style={{ marginTop: '20px' }}>
          <h2>Organization Not Found</h2>
          <p>We could not find that organization in the current directory.</p>
          <Link className="button button-primary" to="/student/organizations">Browse All Organizations</Link>
        </Card>
      </div>
    )
  }

  const events = getOrganizationEvents(organization, officerEvents)
  const visibleOfficers = (organization.officers ?? []).map((o) => ({
    name: o.name,
    position: o.role || o.position,
  }))
  const orgDocuments = organization.documents?.length
    ? organization.documents
    : adviserDocuments
        .filter((d) => String(d.organizationId) === String(organization.id) && d.status === 'APPROVED')
        .map((d) => d.title)

  const publishedAnnouncements = (organization.announcements ?? []).filter((announcement) => (
    !announcement.status || announcement.status === 'PUBLISHED'
  ))
  const canApply = status === 'NOT_MEMBER' || status === 'REJECTED' || status === 'INACTIVE'
  const activeMembersCount = organization.activeMembers ?? organization.memberCount ?? 0

  async function confirmApplication() {
    const undo = captureUndo()
    const result = await submitMembershipApplication(organization)
    setApplicationOpen(false)
    if (result?.ok) {
      showToast('Membership application submitted successfully.', 'success', undoAction(undo))
    } else {
      showToast(result?.error || 'Unable to submit membership application.', 'error')
    }
  }

  const tabs = [
    { key: 'overview', label: 'Overview', active: activeTab === 'overview', onClick: () => setActiveTab('overview') },
    { key: 'about', label: 'About', active: activeTab === 'about', onClick: () => setActiveTab('about') },
    { key: 'announcements', label: 'Announcements', count: publishedAnnouncements.length, active: activeTab === 'announcements', onClick: () => setActiveTab('announcements') },
    { key: 'events', label: 'Events', count: events.length, active: activeTab === 'events', onClick: () => setActiveTab('events') },
    { key: 'officers', label: 'Officers', count: visibleOfficers.length, active: activeTab === 'officers', onClick: () => setActiveTab('officers') },
    { key: 'documents', label: 'Documents', count: orgDocuments.length, active: activeTab === 'documents', onClick: () => setActiveTab('documents') },
  ]

  const actionControls = (
    <div className="student-org-actions">
      {status === 'ACTIVE' && (
        <span className="student-member-badge-active">
          <Icon name="check" size={14} /> Active Member
        </span>
      )}
      {status === 'PENDING' && (
        <span className="student-member-badge-pending">
          <Icon name="clock" size={14} /> Application Pending
        </span>
      )}
      {status === 'SUSPENDED' && (
        <Badge tone="danger">Membership Suspended</Badge>
      )}
      {canApply && (
        <Button
          className="button button-primary"
          onClick={() => setApplicationOpen(true)}
        >
          <Icon name="plus" size={14} /> {status === 'REJECTED' ? 'Apply Again' : 'Join Organization'}
        </Button>
      )}
    </div>
  )

  return (
    <div className="student-organization-details fb-page">
      <div className="student-org-top-nav">
        <Link className="student-org-back-link" to="/student/organizations">
          <Icon name="back" size={14} /> Organizations
        </Link>
        <span className="student-org-breadcrumb-sep">/</span>
        <span className="student-org-breadcrumb-current">{organization.name}</span>
      </div>

      <ProfileCover
        actions={actionControls}
        avatarText={organization.acronym}
        badges={(
          <>
            {status !== 'NOT_MEMBER' && <MembershipBadge status={status} />}
            <Badge tone="crimson">{organization.category}</Badge>
          </>
        )}
        eyebrow={`${organization.category} · ${organization.acronym}`}
        label="Organization Profile"
        logo={organization.logo}
        showCover={false}
        subtitle={
          <>
            {activeMembersCount} active members <i aria-hidden="true">·</i> Faculty Adviser: <strong>{organization.adviser}</strong>
          </>
        }
        tabs={tabs}
        tabsLabel="Organization profile sections"
        title={organization.name}
      />

      <div className="fb-body">
        <aside aria-label="Organization Information" className="fb-side">
          <Card className="fb-card">
            <div className="fb-card-heading">
              <h2>About Organization</h2>
            </div>
            <p className="fb-intro-text">{organization.description}</p>
            <ul className="fb-intro-list">
              <li>
                <span aria-hidden="true"><Icon name="category" /></span>
                <div>Category: <strong>{organization.category}</strong></div>
              </li>
              <li>
                <span aria-hidden="true"><Icon name="members" /></span>
                <div>Active Members: <strong>{activeMembersCount} students</strong></div>
              </li>
              <li>
                <span aria-hidden="true"><Icon name="adviser" /></span>
                <div>Faculty Adviser: <strong>{organization.adviser}</strong></div>
              </li>
              <li>
                <span aria-hidden="true"><Icon name="tag" /></span>
                <div>Acronym: <strong>{organization.acronym}</strong></div>
              </li>
            </ul>

            <div className="student-mission-vision-grid">
              <div className="student-mission-box">
                <span className="student-mv-label">Mission</span>
                <p className="student-mv-text">{organization.mission || organization.description}</p>
              </div>
              {organization.vision && (
                <div className="student-vision-box">
                  <span className="student-mv-label">Vision</span>
                  <p className="student-mv-text">{organization.vision}</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="fb-card">
            <div className="fb-card-heading">
              <h2>Executive Officers</h2>
              {visibleOfficers.length > 6 && (
                <button className="fb-link-button" onClick={() => setActiveTab('officers')} type="button">
                  See all ({visibleOfficers.length})
                </button>
              )}
            </div>
            {visibleOfficers.length ? (
              <div className="fb-officer-grid">
                {visibleOfficers.slice(0, 6).map((officer, index) => (
                  <div className="fb-officer-tile" key={`${officer.name}-${index}`}>
                    <span aria-hidden="true">{getInitials(officer.name)}</span>
                    <strong>{officer.name.split(',')[0]}</strong>
                    <small>{officer.position}</small>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No officers listed" />
            )}
          </Card>

          <Card className="fb-card">
            <div className="fb-card-heading">
              <h2>Public Documents</h2>
              {orgDocuments.length > 2 && (
                <button className="fb-link-button" onClick={() => setActiveTab('documents')} type="button">
                  See all
                </button>
              )}
            </div>
            {orgDocuments.length ? (
              <div className="student-documents-stack">
                {orgDocuments.map((doc) => (
                  <div className="student-doc-card" key={doc}>
                    <span aria-hidden="true" className="student-doc-icon"><Icon name="document" size={16} /></span>
                    <div className="student-doc-info">
                      <strong>{doc}</strong>
                      <small>Public Document · On File</small>
                    </div>
                    <button
                      className="student-doc-action"
                      onClick={() => setSelectedDoc(doc)}
                      type="button"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No public documents" />
            )}
          </Card>
        </aside>

        <div className="fb-feed">
          {status === 'PENDING' && (
            <div className="student-membership-callout status-pending">
              <div className="student-membership-callout-icon" aria-hidden="true">
                <Icon name="clock" size={20} />
              </div>
              <div className="student-membership-callout-copy">
                <strong>Application Pending Review</strong>
                <p>Your membership application has been submitted and is currently being evaluated by the organization officers.</p>
              </div>
            </div>
          )}

          {status === 'REJECTED' && (
            <div className="student-membership-callout status-rejected">
              <div className="student-membership-callout-icon" aria-hidden="true">
                <Icon name="alert" size={20} />
              </div>
              <div className="student-membership-callout-copy">
                <strong>Application Not Approved</strong>
                <p>Your previous application was not accepted. You may submit a new application during the open recruitment period.</p>
              </div>
              <Button onClick={() => setApplicationOpen(true)}>Apply Again</Button>
            </div>
          )}

          {canApply && status === 'NOT_MEMBER' && (
            <div className="student-membership-callout status-join">
              <div className="student-membership-callout-icon" aria-hidden="true">
                <Icon name="star" size={20} />
              </div>
              <div className="student-membership-callout-copy">
                <strong>Become a Member</strong>
                <p>Join {organization.name} to connect with peers, attend hands-on workshops, and participate in campus activities.</p>
              </div>
              <Button onClick={() => setApplicationOpen(true)}>Join Organization</Button>
            </div>
          )}

          {activeTab === 'overview' && (
            <>
              <Card className="fb-card">
                <div className="fb-card-heading">
                  <h2>Recent Announcements</h2>
                  {publishedAnnouncements.length > 2 && (
                    <button className="fb-link-button" onClick={() => setActiveTab('announcements')} type="button">
                      See all ({publishedAnnouncements.length})
                    </button>
                  )}
                </div>
                {publishedAnnouncements.length ? (
                  <div className="student-announcements-feed">
                    {publishedAnnouncements.map((announcement, index) => (
                      <article className="student-announcement-card" key={announcement.id ?? announcement.title ?? index}>
                        <div className="student-announcement-header">
                          <div className="student-announcement-meta">
                            <span aria-hidden="true" className="fb-mini-avatar">{(organization.acronym || organization.name).slice(0, 3)}</span>
                            <div>
                              <strong>{organization.name}</strong>
                              <time>{announcement.datePosted ?? announcement.date}</time>
                            </div>
                          </div>
                          <Badge tone="crimson">Official Announcement</Badge>
                        </div>
                        <h3 className="student-announcement-title">{announcement.title}</h3>
                        <p className="student-announcement-body">
                          {announcement.content ?? announcement.description ?? 'Official update shared with organization members.'}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState description="This organization has not published any announcements yet." title="No recent announcements" />
                )}
              </Card>

              <Card className="fb-card">
                <div className="fb-card-heading">
                  <h2>Upcoming Events</h2>
                  {events.length > 2 && (
                    <button className="fb-link-button" onClick={() => setActiveTab('events')} type="button">
                      See all ({events.length})
                    </button>
                  )}
                </div>
                {events.length ? (
                  <div className="student-events-stack">
                    {events.map((event) => {
                      const { month, day } = parseEventDate(event.date)
                      return (
                        <Link className="student-event-card" key={event.id} to={`/student/events/${event.id}`}>
                          <div className="student-event-cal">
                            <span className="student-event-cal-month">{month}</span>
                            <span className="student-event-cal-day">{day}</span>
                          </div>
                          <div className="student-event-details">
                            <strong>{event.title}</strong>
                            <div className="student-event-meta-line">
                              <span><Icon name="calendar" size={13} /> {event.date}</span>
                              <span><Icon name="time" size={13} /> {event.time}</span>
                              {event.location && <span><Icon name="location" size={13} /> {event.location}</span>}
                            </div>
                          </div>
                          <span aria-hidden="true" className="student-event-arrow">
                            <Icon name="arrow-right" size={15} />
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyState description="Check back soon for upcoming campus activities and workshops from this organization." title="No upcoming events" />
                )}
              </Card>
            </>
          )}

          {activeTab === 'about' && (
            <Card className="fb-card">
              <div className="fb-card-heading">
                <h2>About {organization.name}</h2>
              </div>
              <p className="fb-intro-text" style={{ textAlign: 'left', marginBottom: '20px' }}>
                {organization.description}
              </p>
              <ul className="fb-intro-list" style={{ marginTop: '16px' }}>
                <li>
                  <span aria-hidden="true"><Icon name="category" /></span>
                  <div>Organization Category: <strong>{organization.category}</strong></div>
                </li>
                <li>
                  <span aria-hidden="true"><Icon name="members" /></span>
                  <div>Active Membership: <strong>{activeMembersCount} registered members</strong></div>
                </li>
                <li>
                  <span aria-hidden="true"><Icon name="adviser" /></span>
                  <div>Faculty Adviser: <strong>{organization.adviser}</strong></div>
                </li>
              </ul>
            </Card>
          )}

          {activeTab === 'announcements' && (
            <Card className="fb-card">
              <div className="fb-card-heading">
                <h2>All Announcements ({publishedAnnouncements.length})</h2>
              </div>
              {publishedAnnouncements.length ? (
                <div className="student-announcements-feed">
                  {publishedAnnouncements.map((announcement, index) => (
                    <article className="student-announcement-card" key={announcement.id ?? announcement.title ?? index}>
                      <div className="student-announcement-header">
                        <div className="student-announcement-meta">
                          <span aria-hidden="true" className="fb-mini-avatar">{(organization.acronym || organization.name).slice(0, 3)}</span>
                          <div>
                            <strong>{organization.name}</strong>
                            <time>{announcement.datePosted ?? announcement.date}</time>
                          </div>
                        </div>
                        <Badge tone="crimson">Official Announcement</Badge>
                      </div>
                      <h3 className="student-announcement-title">{announcement.title}</h3>
                      <p className="student-announcement-body">
                        {announcement.content ?? announcement.description ?? 'Official update shared with organization members.'}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState description="This organization has not published any announcements yet." title="No announcements found" />
              )}
            </Card>
          )}

          {activeTab === 'events' && (
            <Card className="fb-card">
              <div className="fb-card-heading">
                <h2>Upcoming & Scheduled Events ({events.length})</h2>
              </div>
              {events.length ? (
                <div className="student-events-stack">
                  {events.map((event) => {
                    const { month, day } = parseEventDate(event.date)
                    return (
                      <Link className="student-event-card" key={event.id} to={`/student/events/${event.id}`}>
                        <div className="student-event-cal">
                          <span className="student-event-cal-month">{month}</span>
                          <span className="student-event-cal-day">{day}</span>
                        </div>
                        <div className="student-event-details">
                          <strong>{event.title}</strong>
                          <div className="student-event-meta-line">
                            <span><Icon name="calendar" size={13} /> {event.date}</span>
                            <span><Icon name="time" size={13} /> {event.time}</span>
                            {event.location && <span><Icon name="location" size={13} /> {event.location}</span>}
                          </div>
                        </div>
                        <span aria-hidden="true" className="student-event-arrow">
                          <Icon name="arrow-right" size={15} />
                        </span>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <EmptyState description="Check back soon for upcoming campus activities and workshops." title="No scheduled events" />
              )}
            </Card>
          )}

          {activeTab === 'officers' && (
            <Card className="fb-card">
              <div className="fb-card-heading">
                <h2>Organization Leadership ({visibleOfficers.length})</h2>
              </div>
              {visibleOfficers.length ? (
                <div className="student-officers-full-grid">
                  {visibleOfficers.map((officer, index) => (
                    <div className="student-officer-card" key={`${officer.name}-${index}`}>
                      <span aria-hidden="true" className="student-officer-avatar-large">
                        {getInitials(officer.name)}
                      </span>
                      <strong>{officer.name}</strong>
                      <small>Executive Officer</small>
                      <Badge style={{ marginTop: '8px' }} tone="crimson">{officer.position}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No officers recorded" />
              )}
            </Card>
          )}

          {activeTab === 'documents' && (
            <Card className="fb-card">
              <div className="fb-card-heading">
                <h2>Public Documents & Records ({orgDocuments.length})</h2>
              </div>
              {orgDocuments.length ? (
                <div className="student-documents-stack">
                  {orgDocuments.map((doc) => (
                    <div className="student-doc-card" key={doc}>
                      <span aria-hidden="true" className="student-doc-icon"><Icon name="document" size={16} /></span>
                      <div className="student-doc-info">
                        <strong>{doc}</strong>
                        <small>Public Student Document · Verified by Student Affairs</small>
                      </div>
                      <button
                        className="student-doc-action"
                        onClick={() => setSelectedDoc(doc)}
                        type="button"
                      >
                        View Document
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No public documents" />
              )}
            </Card>
          )}
        </div>
      </div>

      <Modal
        onClose={() => setApplicationOpen(false)}
        open={applicationOpen}
        title={`Join ${organization.name}?`}
      >
        <div style={{ display: 'grid', gap: '14px', padding: '6px 0' }}>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>
            Submit your membership application to <strong>{organization.name}</strong>?
          </p>
          <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'var(--canvas)', border: '1px solid var(--border)', fontSize: '13px' }}>
            <span style={{ color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Membership Terms:</span>
            Your student profile information will be shared with the organization officers and adviser for review.
          </div>
          <div className="organization-application-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <Button onClick={() => setApplicationOpen(false)} variant="secondary">Cancel</Button>
            <Button onClick={confirmApplication}>Submit Application</Button>
          </div>
        </div>
      </Modal>

      <Modal
        onClose={() => setSelectedDoc(null)}
        open={Boolean(selectedDoc)}
        title={selectedDoc ?? 'Document Preview'}
      >
        <div className="student-doc-preview-body">
          <div className="student-doc-preview-callout">
            This document is on official record with the <strong>Western Mindanao State University</strong> Student Affairs and Services Division (SASD).
          </div>
          <dl className="student-doc-preview-meta">
            <div className="student-doc-preview-item">
              <dt>Organization</dt>
              <dd>{organization.name}</dd>
            </div>
            <div className="student-doc-preview-item">
              <dt>Classification</dt>
              <dd>Public Record</dd>
            </div>
            <div className="student-doc-preview-item">
              <dt>Status</dt>
              <dd>Accredited & On File</dd>
            </div>
          </dl>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button onClick={() => setSelectedDoc(null)} variant="secondary">Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
