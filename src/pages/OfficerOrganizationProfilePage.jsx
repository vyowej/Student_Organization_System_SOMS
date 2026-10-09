import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'
import { officerActivity, officerOrganization } from '../data/officerPortal.js'
import { formatDisplayName } from '../data/displayName.js'

const editableFields = ['name', 'acronym', 'category', 'mission', 'vision']
const categories = ['Academic', 'Technology', 'Leadership', 'Socio-Civic', 'Cultural', 'Sports', 'Other']
const documentTypes = ['Constitution & By-Laws', 'Accreditation Document', 'Officer Roster', 'Event Proposal', 'Safety Plan', 'Financial Statement', 'Accomplishment Report', 'Other']

function statusTone(status = '') {
  if (['ACTIVE', 'ACCREDITED', 'APPROVED', 'PUBLISHED', 'ONGOING'].includes(status)) return 'success'
  if (['PENDING', 'UNDER_REVIEW', 'SUBMITTED'].includes(status)) return 'warning'
  if (['RETURNED', 'RETURNED_FOR_REVISION', 'REJECTED'].includes(status)) return 'danger'
  return 'neutral'
}

function SectionHeading({ action, title }) {
  return <div className="officer-profile-section-heading"><h2>{title}</h2>{action}</div>
}

function formatTime(event) {
  return event.time || event.startTime || 'Time not set'
}

export default function OfficerOrganizationProfilePage() {
  const {
    addOfficerDocument,
    captureUndo,
    adminOrganizations,
    adminAuditLogs,
    adviserDocuments,
    officerEvents,
    officerMembers,
    officerMemberCount,
    officerMembershipRequests,
    updateOfficerOrganizationProfile,
  } = useOutletContext()
  const { showToast } = useToast()
  const organization = adminOrganizations.find((item) => item.id === officerOrganization.id)
  const [editOpen, setEditOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [profileForm, setProfileForm] = useState(null)
  const [documentForm, setDocumentForm] = useState({ title: '', type: documentTypes[0], file: null })

  if (!organization) {
    return <EmptyState title="Organization profile unavailable" description="The organization assigned to this officer account could not be found." />
  }

  const members = officerMembers.filter((member) => member.organizationId === organization.id)
  const activeMembers = members.filter((member) => member.status === 'ACTIVE')
  const executiveOfficers = activeMembers
    .filter((member) => ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'PIO', 'Committee Head'].includes(member.position))
    .sort((first, second) => ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'PIO', 'Committee Head'].indexOf(first.position) - ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'PIO', 'Committee Head'].indexOf(second.position))
  const pendingRequests = officerMembershipRequests.filter((request) => request.status === 'PENDING')
  const documents = adviserDocuments.filter((document) => document.organizationId === organization.id)
  const upcomingEvents = officerEvents.filter((event) => (
    ['APPROVED', 'PUBLISHED', 'ONGOING'].includes(event.status)
  )).slice(0, 4)
  const announcements = organization.announcements ?? []
  const auditEntries = adminAuditLogs
    .filter((entry) => entry.entityId === organization.id || entry.description?.includes(organization.name))
    .slice(0, 5)
  const activities = [
    ...auditEntries.map((entry) => ({ id: entry.id, message: entry.description, time: entry.timestamp, person: entry.actor })),
    ...officerActivity.slice(0, Math.max(0, 5 - auditEntries.length)).map((entry) => ({
      id: entry.id,
      message: entry.message,
      time: entry.time,
      person: 'Organization team',
    })),
  ].slice(0, 5)
  const totalMembers = officerMemberCount + members.filter((member) => member.status !== 'ACTIVE').length + pendingRequests.length

  function openEdit() {
    setProfileForm(Object.fromEntries(editableFields.map((field) => [field, organization[field] ?? ''])))
    setFormError('')
    setEditOpen(true)
  }

  function saveProfile(event) {
    event.preventDefault()
    if (editableFields.some((field) => !profileForm[field].trim())) {
      setFormError('Organization name, acronym, category, mission, and vision are required.')
      return
    }
    const undo = captureUndo()
    if (!updateOfficerOrganizationProfile(profileForm)) {
      setFormError('The profile could not be saved. Check your officer permissions and try again.')
      return
    }
    setEditOpen(false)
    showToast('Organization profile updated successfully.', 'success', undoAction(undo))
  }

  function uploadDocument(event) {
    event.preventDefault()
    if (!documentForm.title.trim() || !documentForm.type || !documentForm.file) {
      setFormError('Enter a document name, choose a type, and select a file.')
      return
    }
    const undo = captureUndo()
    const saved = addOfficerDocument({
      title: documentForm.title,
      type: documentForm.type,
      fileName: documentForm.file.name,
    })
    if (!saved) {
      setFormError('The document could not be added to the shared organization records.')
      return
    }
    setUploadOpen(false)
    setDocumentForm({ title: '', type: documentTypes[0], file: null })
    setFormError('')
    showToast('Document submitted for adviser review.', 'success', undoAction(undo))
  }

  return (
    <div className="officer-organization-profile">
      <PageHeader
        description="Manage your organization profile and review its shared membership, document, and activity records."
        eyebrow="ORGANIZATION MANAGEMENT"
        title="Organization Profile"
      >
        <Card className="officer-org-hero">
          <div aria-hidden="true" className="officer-org-hero-logo">{organization.logo ? <img alt="" src={organization.logo} /> : organization.acronym}</div>
          <div className="officer-org-hero-copy">
            <div className="officer-org-eyebrow">{organization.category} · {organization.acronym}</div>
            <h2>{organization.name}</h2>
            <div className="officer-org-status-line">
              <Badge tone={statusTone(organization.accreditationStatus ?? organization.status)}>{organization.accreditationStatus ?? organization.status}</Badge>
              <span>Faculty Adviser: <strong>{organization.adviser}</strong></span>
            </div>
          </div>
          <Button onClick={openEdit}><span aria-hidden="true">✎</span> Edit Organization Profile</Button>
        </Card>
      </PageHeader>

      <Card className="officer-org-information">
        <SectionHeading title="Organization Information" action={<Button onClick={openEdit} variant="secondary">Edit Information</Button>} />
        <dl className="officer-org-info-grid">
          <div><dt>Official Name</dt><dd>{organization.name}</dd></div>
          <div><dt>Acronym</dt><dd>{organization.acronym}</dd></div>
          <div><dt>Category</dt><dd>{organization.category}</dd></div>
          <div><dt>Faculty Adviser</dt><dd>{organization.adviser}</dd><small>Adviser assignments are managed by Student Affairs.</small></div>
          <div className="officer-org-info-wide"><dt>Mission</dt><dd>{organization.mission}</dd></div>
          <div className="officer-org-info-wide"><dt>Vision</dt><dd>{organization.vision}</dd></div>
        </dl>
      </Card>

      <div className="officer-org-grid">
        <Card className="officer-org-section">
          <SectionHeading title="Executive Officers" action={<Link className="officer-org-text-link" to="/officer/members">Manage Officers <span aria-hidden="true">→</span></Link>} />
          {executiveOfficers.length ? (
            <div className="officer-org-officer-list">
              {executiveOfficers.map((member) => (
                <div className="officer-org-officer" key={member.id}>
                  <span aria-hidden="true" className="officer-org-person-icon">{member.studentName?.slice(0, 1) ?? 'O'}</span>
                  <div><strong>{formatDisplayName(member)}</strong><small>{member.studentId}</small></div>
                  <div className="officer-org-officer-meta"><Badge tone="crimson">{member.position}</Badge><Badge tone={statusTone(member.status)}>{member.status}</Badge></div>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No executive officers recorded" />}
        </Card>

        <Card className="officer-org-section officer-org-member-summary">
          <SectionHeading title="Members" />
          <div className="officer-org-member-metrics">
            <div><span className="stat-label">Total Members</span><strong className="stat-value">{totalMembers}</strong></div>
            <div><span className="stat-label">Active Members</span><strong className="stat-value">{officerMemberCount}</strong></div>
            <div><span className="stat-label">Pending Requests</span><strong className="stat-value">{pendingRequests.length}</strong></div>
          </div>
          <Link className="button button-secondary" to="/officer/members">View Members</Link>
        </Card>

        <Card className="officer-org-section">
          <SectionHeading title="Official Documents" action={<Link className="officer-org-text-link" to="/officer/documents">View Documents <span aria-hidden="true">→</span></Link>} />
          {documents.length || organization.documents?.length ? (
            <div className="officer-org-document-list">
              {(organization.documents ?? []).map((name) => (
                <div className="officer-org-document" key={`on-file-${name}`}>
                  <span aria-hidden="true" className="officer-org-document-icon">▤</span><div><strong>{name}</strong><small>ORGANIZATION DOCUMENT · On file</small></div><Badge tone="success">ON FILE</Badge>
                </div>
              ))}
              {documents.map((document) => (
                <div className="officer-org-document" key={document.id}>
                  <span aria-hidden="true" className="officer-org-document-icon">▤</span><div><strong>{document.title}</strong><small>{document.type} · Submitted {document.submittedDate}</small></div><Badge tone={statusTone(document.status)}>{document.status}</Badge>
                </div>
              ))}
            </div>
          ) : <EmptyState title="No organization documents" description="Upload a document to start an adviser review." />}
          <Button className="officer-org-section-action" onClick={() => { setFormError(''); setUploadOpen(true) }} variant="secondary">＋ Upload Document</Button>
        </Card>

        <Card className="officer-org-section">
          <SectionHeading title="Upcoming Events" action={<Link className="officer-org-text-link" to="/officer/events">View All Events <span aria-hidden="true">→</span></Link>} />
          {upcomingEvents.length ? <div className="officer-org-event-list">{upcomingEvents.map((event) => (
            <article className="officer-org-event" key={event.id}>
              <span aria-hidden="true" className="officer-org-event-icon">◷</span><div><strong>{event.title}</strong><small>{event.date} · {formatTime(event)} · {event.location || event.venue || 'Venue not set'}</small></div><Badge tone={statusTone(event.status)}>{event.status.replaceAll('_', ' ')}</Badge>
            </article>
          ))}</div> : <EmptyState title="No upcoming approved events" description="Approved and published events will appear here." />}
        </Card>

        <Card className="officer-org-section">
          <SectionHeading title="Recent Announcements" action={<Link className="officer-org-text-link" to="/officer/announcements">View All <span aria-hidden="true">→</span></Link>} />
          {announcements.length ? <div className="officer-org-announcements">{announcements.slice(0, 4).map((announcement, index) => (
            <article className="officer-org-announcement" key={`${announcement.title}-${index}`}>
              <span aria-hidden="true">▤</span><div><strong>{announcement.title}</strong><small>{announcement.date}</small><p>{announcement.description || 'Official update shared with organization members.'}</p></div>
            </article>
          ))}</div> : <EmptyState title="No announcements yet" description="Post an update for your organization members." />}
          <div className="officer-org-announcement-actions">
            <Link className="button button-primary" to="/officer/announcements">＋ Create Announcement</Link>
            <Link className="button button-secondary" to="/officer/announcements">View All Announcements</Link>
          </div>
        </Card>

        <Card className="officer-org-section">
          <SectionHeading title="Organization Activity" />
          {activities.length ? <div className="officer-org-activity-list">{activities.map((activity) => (
            <article className="officer-org-activity" key={activity.id}>
              <span aria-hidden="true" className="officer-org-activity-dot" />
              <div><p>{activity.message}</p><small>{activity.time} · {activity.person}</small></div>
            </article>
          ))}</div> : <EmptyState title="No activity recorded" />}
        </Card>
      </div>

      <Modal onClose={() => setEditOpen(false)} open={editOpen} title="Edit Organization Profile">
        {profileForm && <form className="officer-org-form" onSubmit={saveProfile}>
          <label>Organization Name<input onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} required value={profileForm.name} /></label>
          <label>Acronym<input onChange={(event) => setProfileForm((current) => ({ ...current, acronym: event.target.value }))} required value={profileForm.acronym} /></label>
          <label>Category<select onChange={(event) => setProfileForm((current) => ({ ...current, category: event.target.value }))} required value={profileForm.category}>{[...new Set([...categories, profileForm.category])].map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Mission<textarea onChange={(event) => setProfileForm((current) => ({ ...current, mission: event.target.value }))} required rows="3" value={profileForm.mission} /></label>
          <label>Vision<textarea onChange={(event) => setProfileForm((current) => ({ ...current, vision: event.target.value }))} required rows="3" value={profileForm.vision} /></label>
          <label>Faculty Adviser<input disabled value={organization.adviser} /><small>Only Student Affairs can change the adviser assignment.</small></label>
          {formError && <p className="auth-error" role="alert">{formError}</p>}
          <div className="officer-org-modal-actions"><Button onClick={() => setEditOpen(false)} variant="secondary">Cancel</Button><Button type="submit">Save Changes</Button></div>
        </form>}
      </Modal>

      <Modal onClose={() => setUploadOpen(false)} open={uploadOpen} title="Upload Organization Document">
        <form className="officer-org-form" onSubmit={uploadDocument}>
          <label>Document Name<input onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))} required value={documentForm.title} /></label>
          <label>Document Type<select onChange={(event) => setDocumentForm((current) => ({ ...current, type: event.target.value }))} value={documentForm.type}>{documentTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label>Choose File<input accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(event) => setDocumentForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} required type="file" /></label>
          <p className="officer-org-upload-note">This frontend preview records the file name and submits the document metadata for adviser review. File storage will require a backend.</p>
          {formError && <p className="auth-error" role="alert">{formError}</p>}
          <div className="officer-org-modal-actions"><Button onClick={() => setUploadOpen(false)} variant="secondary">Cancel</Button><Button type="submit">Submit Document</Button></div>
        </form>
      </Modal>
    </div>
  )
}
