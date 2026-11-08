import { useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Modal from '../components/ui/Modal.jsx'
import SearchableSelect from '../components/ui/SearchableSelect.jsx'
import ProfileCover from '../components/layout/ProfileCover.jsx'
import { useToast } from '../components/ui/useToast.js'
import Icon from '../components/ui/Icon.jsx'
import { usePortalData } from '../context/usePortalData.js'
import { useAuth } from '../context/useAuth.js'
import { getOrganizationEvents, studentOrganizations } from '../data/studentEvents.js'
import {
  OFFICER_HIERARCHY,
  ORGANIZATION_COMMITTEES,
  YEAR_LEVEL_OPTIONS,
  getHierarchyEntry,
  readFileAsDataUrl,
  sanitizeNumericStudentId,
} from '../data/officerHierarchy.js'

const statusLabels = {
  NOT_MEMBER: 'NOT ENROLLED',
  PENDING: 'PENDING REVIEW',
  ACTIVE: 'ACTIVE OFFICER',
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
  const outletCtx = useOutletContext() || {}
  const portalData = usePortalData()
  const { currentUser } = useAuth()
  const { showToast } = useToast()

  const adminOrganizations = outletCtx.adminOrganizations || portalData?.adminOrganizations || []
  const contextStudentOrganizations = outletCtx.studentOrganizations || portalData?.studentOrganizations || []
  const officerEvents = outletCtx.officerEvents || portalData?.officerEvents || []
  const officerAnnouncements = outletCtx.officerAnnouncements || portalData?.officerAnnouncements || []
  const adviserDocuments = outletCtx.adviserDocuments || portalData?.adviserDocuments || []
  const academicPrograms = outletCtx.academicPrograms || portalData?.academicPrograms || []
  const getMembershipForOrganization = outletCtx.getMembershipForOrganization || portalData?.getMembershipForOrganization
  const submitMembershipApplication = outletCtx.submitMembershipApplication || portalData?.submitMembershipApplication

  const [activeTab, setActiveTab] = useState('overview')
  const [applicationOpen, setApplicationOpen] = useState(false)
  const [desiredRole, setDesiredRole] = useState('OTHER_OFFICER')
  const [desiredCommittee, setDesiredCommittee] = useState('Programs & Events Committee')
  const [applicantForm, setApplicantForm] = useState({
    firstName: currentUser?.firstName || '',
    lastName: currentUser?.lastName || '',
    email: currentUser?.email || '',
    studentNumber: sanitizeNumericStudentId(currentUser?.studentNumber || ''),
    yearLevel: currentUser?.yearLevel || '1st Year',
    program: currentUser?.program || '',
    corFileName: currentUser?.corFileName || '',
    corFileData: null,
  })
  const [submitting, setSubmitting] = useState(false)
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
          <Link className="student-org-back-link" to="/organizations">
            <Icon name="arrow-left" size={14} /> Back to Organizations
          </Link>
        </div>
        <Card className="organization-not-found" style={{ marginTop: '20px' }}>
          <h2>Organization Not Found</h2>
          <p>We could not find that organization in the current directory.</p>
          <Link className="button button-primary" to="/organizations">Browse All Organizations</Link>
        </Card>
      </div>
    )
  }

  const events = getOrganizationEvents(organization, officerEvents)
  const visibleOfficers = (organization.officers ?? []).map((o) => ({
    name: o.name,
    position: o.role || o.position,
    committee: o.committee || getHierarchyEntry(o.rawPosition || o.position).defaultCommittee,
    tierLabel: getHierarchyEntry(o.rawPosition || o.position).tierLabel,
  }))
  const orgDocuments = organization.documents?.length
    ? organization.documents
    : adviserDocuments
        .filter((d) => String(d.organizationId) === String(organization.id) && d.status === 'APPROVED')
        .map((d) => d.title)

  const orgAnnouncementsList = (organization.announcements && organization.announcements.length > 0)
    ? organization.announcements
    : officerAnnouncements.filter((a) => String(a.organizationId) === String(organization.id))
  const publishedAnnouncements = orgAnnouncementsList.filter((announcement) => (
    !announcement.status || announcement.status === 'PUBLISHED'
  ))
  const canApply = status === 'NOT_MEMBER' || status === 'REJECTED' || status === 'INACTIVE'
  const activeMembersCount = organization.activeMembers ?? organization.memberCount ?? 0

  const existingPresident = (organization.officers ?? []).find(
    (o) => o.rawPosition === 'PRESIDENT' || o.position === 'President' || o.role === 'President'
  )

  async function handleCorUpload(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setApplicantForm((prev) => ({
        ...prev,
        corFileName: file.name,
        corFileData: dataUrl,
      }))
    } catch {
      showToast('Unable to read selected COR file.', 'error')
    }
  }

  async function confirmApplication(event) {
    event.preventDefault()
    if (desiredRole === 'PRESIDENT' && existingPresident) {
      showToast(`${organization.name} already has an active President (${existingPresident.name}).`, 'error')
      return
    }
    const cleanId = sanitizeNumericStudentId(applicantForm.studentNumber)
    if (!currentUser && (!cleanId || !/^\d+$/.test(cleanId))) {
      showToast('Please enter a valid numeric Student ID (digits only).', 'error')
      return
    }
    if (!currentUser && !applicantForm.program) {
      showToast('Please select your Course / Program.', 'error')
      return
    }
    if (!applicantForm.corFileName && !currentUser?.corFileName) {
      showToast('Please upload your Certificate of Registration (COR).', 'error')
      return
    }

    setSubmitting(true)
    const roleLabel = `${getHierarchyEntry(desiredRole).title} (${desiredCommittee})`
    const result = await submitMembershipApplication(organization, {
      desiredRole: roleLabel,
      firstName: applicantForm.firstName,
      lastName: applicantForm.lastName,
      email: applicantForm.email,
      studentNumber: cleanId,
      yearLevel: applicantForm.yearLevel,
      program: applicantForm.program,
      corFileName: applicantForm.corFileName || currentUser?.corFileName,
      corFileData: applicantForm.corFileData,
    })
    setSubmitting(false)
    if (result?.ok) {
      setApplicationOpen(false)
      showToast('Officer onboarding application submitted successfully.', 'success')
    } else {
      showToast(result?.error || 'Unable to submit application.', 'error')
    }
  }

  const tabs = [
    { key: 'overview', label: 'Overview', active: activeTab === 'overview', onClick: () => setActiveTab('overview') },
    { key: 'about', label: 'About', active: activeTab === 'about', onClick: () => setActiveTab('about') },
    { key: 'announcements', label: 'Announcements', count: publishedAnnouncements.length, active: activeTab === 'announcements', onClick: () => setActiveTab('announcements') },
    { key: 'events', label: 'Events', count: events.length, active: activeTab === 'events', onClick: () => setActiveTab('events') },
    { key: 'officers', label: 'Officer Hierarchy', count: visibleOfficers.length, active: activeTab === 'officers', onClick: () => setActiveTab('officers') },
    { key: 'documents', label: 'Documents', count: orgDocuments.length, active: activeTab === 'documents', onClick: () => setActiveTab('documents') },
  ]

  const actionControls = (
    <div className="student-org-actions">
      {status === 'ACTIVE' && (
        <span className="student-member-badge-active">
          <Icon name="check" size={14} /> Active Officer
        </span>
      )}
      {status === 'PENDING' && (
        <span className="student-member-badge-pending">
          <Icon name="clock" size={14} /> Application Pending
        </span>
      )}
      {status === 'SUSPENDED' && (
        <Badge tone="danger">Suspended</Badge>
      )}
      {canApply && (
        <Button
          className="button button-primary"
          onClick={() => setApplicationOpen(true)}
        >
          <Icon name="plus" size={14} /> {status === 'REJECTED' ? 'Apply Again' : 'Apply as Officer'}
        </Button>
      )}
    </div>
  )

  return (
    <div className="student-organization-details fb-page">
      <div className="student-org-top-nav">
        <Link className="student-org-back-link" to="/organizations">
          <Icon name="back" size={14} /> Organizations Directory
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
            {activeMembersCount} active officers <i aria-hidden="true">·</i> Faculty Adviser: <strong>{organization.adviser}</strong>
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
                <div>Active Officers: <strong>{activeMembersCount}</strong></div>
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
              <h2>Executive Hierarchy</h2>
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
                <strong>Officer Application Pending Review</strong>
                <p>Your officer onboarding request and COR have been submitted for review by the organization leadership and adviser.</p>
              </div>
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
                          {announcement.content ?? announcement.description ?? 'Official update shared by organization officers.'}
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
                        <Link className="student-event-card" key={event.id} to={`/events/${event.id}`}>
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
                  <EmptyState description="Check back soon for upcoming campus activities and programs from this organization." title="No upcoming events" />
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
                  <div>Active Officers & Committee Roster: <strong>{activeMembersCount}</strong></div>
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
                        {announcement.content ?? announcement.description ?? 'Official update shared by organization officers.'}
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
                      <Link className="student-event-card" key={event.id} to={`/events/${event.id}`}>
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
                <h2>Officer Hierarchy & Committees ({visibleOfficers.length})</h2>
              </div>
              {visibleOfficers.length ? (
                <div className="student-officers-full-grid">
                  {visibleOfficers.map((officer, index) => (
                    <div className="student-officer-card" key={`${officer.name}-${index}`}>
                      <span aria-hidden="true" className="student-officer-avatar-large">
                        {getInitials(officer.name)}
                      </span>
                      <strong>{officer.name}</strong>
                      <small>{officer.committee}</small>
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
                        <small>Public Document · Verified by Student Affairs</small>
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
        size="md"
        title={`Apply as Officer — ${organization.name}`}
      >
        <form onSubmit={confirmApplication} style={{ display: 'grid', gap: '14px', padding: '4px 0' }}>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>
            Select your desired officer position &amp; assigned committee in <strong>{organization.name}</strong>, and attach your Certificate of Registration (COR).
          </p>

          {!currentUser && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
              <label className="inline-required-label" style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>First Name <span className="required-asterisk">*</span></span>
                <input
                  className="input"
                  onChange={(e) => setApplicantForm((p) => ({ ...p, firstName: e.target.value }))}
                  required
                  type="text"
                  value={applicantForm.firstName}
                />
              </label>
              <label className="inline-required-label" style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>Last Name <span className="required-asterisk">*</span></span>
                <input
                  className="input"
                  onChange={(e) => setApplicantForm((p) => ({ ...p, lastName: e.target.value }))}
                  required
                  type="text"
                  value={applicantForm.lastName}
                />
              </label>
              <label className="inline-required-label" style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>Student ID (Numbers Only) <span className="required-asterisk">*</span></span>
                <input
                  className="input"
                  inputMode="numeric"
                  onChange={(e) => setApplicantForm((p) => ({ ...p, studentNumber: sanitizeNumericStudentId(e.target.value) }))}
                  pattern="[0-9]*"
                  placeholder="e.g. 202401482"
                  required
                  type="text"
                  value={applicantForm.studentNumber}
                />
              </label>
              <label className="inline-required-label" style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>WMSU Email <span className="required-asterisk">*</span></span>
                <input
                  className="input"
                  onChange={(e) => setApplicantForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="name@wmsu.edu.ph"
                  required
                  type="email"
                  value={applicantForm.email}
                />
              </label>
              <label className="inline-required-label" style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>Year Level <span className="required-asterisk">*</span></span>
                <select
                  className="input"
                  onChange={(e) => setApplicantForm((p) => ({ ...p, yearLevel: e.target.value }))}
                  value={applicantForm.yearLevel}
                >
                  {YEAR_LEVEL_OPTIONS.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
                </select>
              </label>
              <div style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
                <span>Course / Program <span className="required-asterisk">*</span></span>
                <SearchableSelect
                  onChange={(val) => setApplicantForm((p) => ({ ...p, program: val }))}
                  options={academicPrograms}
                  placeholder="Search course / program…"
                  required
                  value={applicantForm.program}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
            <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
              <span>Desired Officer Role <span className="required-asterisk">*</span></span>
              <select
                className="input"
                onChange={(e) => {
                  const code = e.target.value
                  setDesiredRole(code)
                  setDesiredCommittee(getHierarchyEntry(code).defaultCommittee)
                }}
                value={desiredRole}
              >
                {OFFICER_HIERARCHY.map((entry) => (
                  <option
                    disabled={entry.code === 'PRESIDENT' && Boolean(existingPresident)}
                    key={entry.code}
                    value={entry.code}
                  >
                    {entry.title} {entry.code === 'PRESIDENT' && existingPresident ? `(Occupied: ${existingPresident.name})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
              <span>Assigned Committee <span className="required-asterisk">*</span></span>
              <select
                className="input"
                onChange={(e) => setDesiredCommittee(e.target.value)}
                value={desiredCommittee}
              >
                {ORGANIZATION_COMMITTEES.map((comm) => (
                  <option key={comm} value={comm}>{comm}</option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
            <span>Certificate of Registration (COR) <span className="required-asterisk">*</span></span>
            <input
              accept=".pdf,.jpg,.jpeg,.png"
              className="input"
              onChange={handleCorUpload}
              required={!applicantForm.corFileName && !currentUser?.corFileName}
              type="file"
            />
            {(applicantForm.corFileName || currentUser?.corFileName) && (
              <small style={{ color: '#15803d', fontWeight: 600 }}>
                Attached COR: {applicantForm.corFileName || currentUser?.corFileName}
              </small>
            )}
          </label>

          <div className="organization-application-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <Button onClick={() => setApplicationOpen(false)} type="button" variant="secondary">Cancel</Button>
            <Button disabled={submitting || (desiredRole === 'PRESIDENT' && Boolean(existingPresident))} type="submit">
              {submitting ? 'Submitting…' : 'Submit Officer Application'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        onClose={() => setSelectedDoc(null)}
        open={Boolean(selectedDoc)}
        size="lg"
        status="APPROVED"
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
              <dd>Verified Public Record</dd>
            </div>
            <div className="student-doc-preview-item">
              <dt>Status</dt>
              <dd>Accredited &amp; Approved</dd>
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
