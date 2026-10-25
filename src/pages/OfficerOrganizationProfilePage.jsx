import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Modal from '../components/ui/Modal.jsx'
import ProfileCover from '../components/layout/ProfileCover.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'
import Icon from '../components/ui/Icon.jsx'
import { formatDisplayName } from '../data/displayName.js'
import { organizationCategories } from '../data/studentOrganizations.js'

const editableFields = ['name', 'acronym', 'category', 'mission', 'vision']
const documentTypes = ['Constitution & By-Laws', 'Accreditation Document', 'Officer Roster', 'Event Proposal', 'Safety Plan', 'Financial Statement', 'Accomplishment Report', 'Other']

function statusTone(status = '') {
  if (['ACTIVE', 'ACCREDITED', 'APPROVED', 'PUBLISHED', 'ONGOING'].includes(status)) return 'success'
  if (['PENDING', 'UNDER_REVIEW', 'SUBMITTED'].includes(status)) return 'warning'
  if (['RETURNED', 'RETURNED_FOR_REVISION', 'REJECTED'].includes(status)) return 'danger'
  return 'neutral'
}

function SectionHeading({ action, title }) {
  return <div className="fb-card-heading"><h2>{title}</h2>{action}</div>
}

function initials(name = '') {
  return name.split(/[ ,]+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'O'
}

const profileTabs = [
  { key: 'posts', label: 'Posts' },
  { key: 'about', label: 'About' },
  { key: 'officers', label: 'Officers' },
  { key: 'events', label: 'Events' },
  { key: 'documents', label: 'Documents' },
]

function formatTime(event) {
  return event.time || event.startTime || 'Time not set'
}

export default function OfficerOrganizationProfilePage() {
  const {
    addOfficerDocument = async () => false,
    captureUndo = () => () => {},
    currentUser,
    adminOrganizations = [],
    adminAuditLogs = [],
    adminSettings = null,
    adviserDocuments = [],
    officerEvents = [],
    officerMembers = [],
    officerMemberCount = 0,
    officerMembershipRequests = [],
    updateOfficerOrganizationProfile = async () => false,
  } = useOutletContext() || {}
  const { showToast } = useToast()
  const orgId = currentUser?.organizationId || adminOrganizations[0]?.id
  const organization = adminOrganizations.find((item) => String(item.id) === String(orgId)) || adminOrganizations[0]

  const categories = useMemo(() => {
    const fromSettings = (adminSettings?.organizationCategories || []).filter((c) => c !== 'All')
    const fromDefaults = organizationCategories.filter((c) => c !== 'All')
    return [...new Set([...fromSettings, ...fromDefaults])]
  }, [adminSettings?.organizationCategories])
  const [activeTab, setActiveTab] = useState('posts')
  const [editOpen, setEditOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [profileForm, setProfileForm] = useState(null)
  const [documentForm, setDocumentForm] = useState({ title: '', type: documentTypes[0], file: null })

  if (!organization) {
    return <EmptyState title="Organization profile unavailable" description="The organization assigned to this officer account could not be found." />
  }

  const members = officerMembers.filter((member) => String(member.organizationId) === String(organization.id))
  const activeMembers = members.filter((member) => member.status === 'ACTIVE')
  const executiveOfficers = activeMembers
    .filter((member) => ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'PIO', 'Committee Head'].includes(member.position))
    .sort((first, second) => ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'PIO', 'Committee Head'].indexOf(first.position) - ['President', 'Vice President', 'Secretary', 'Treasurer', 'Auditor', 'PIO', 'Committee Head'].indexOf(second.position))
  const pendingRequests = officerMembershipRequests.filter(
    (request) => String(request.organizationId) === String(organization.id) && request.status === 'PENDING'
  )
  const documents = adviserDocuments.filter((document) => String(document.organizationId) === String(organization.id))
  const upcomingEvents = officerEvents.filter((event) => (
    String(event.organizationId) === String(organization.id)
    && ['APPROVED', 'PUBLISHED', 'ONGOING'].includes(event.status)
  )).slice(0, 4)
  const announcements = organization.announcements ?? []
  const auditEntries = adminAuditLogs
    .filter((entry) => String(entry.entityId) === String(organization.id) || entry.description?.includes(organization.name))
    .slice(0, 5)
  const activities = auditEntries.map((entry) => ({
    id: entry.id,
    message: entry.description,
    time: entry.timestamp,
    person: entry.actor,
  }))
  const totalMembers = officerMemberCount + members.filter((member) => member.status !== 'ACTIVE').length + pendingRequests.length

  function openEdit() {
    setProfileForm(Object.fromEntries(editableFields.map((field) => [field, organization[field] ?? ''])))
    setFormError('')
    setEditOpen(true)
  }

  async function saveProfile(event) {
    event.preventDefault()
    if (editableFields.some((field) => !profileForm[field].trim())) {
      setFormError('Organization name, acronym, category, mission, and vision are required.')
      return
    }
    const undo = captureUndo()
    const ok = await updateOfficerOrganizationProfile(profileForm)
    if (!ok) {
      setFormError('The profile could not be saved. Check your officer permissions and try again.')
      return
    }
    setEditOpen(false)
    showToast('Organization profile updated successfully.', 'success', undoAction(undo))
  }

  async function uploadDocument(event) {
    event.preventDefault()
    if (!documentForm.title.trim() || !documentForm.type || !documentForm.file) {
      setFormError('Enter a document name, choose a type, and select a file.')
      return
    }
    const undo = captureUndo()

    // =========================================================================
    // [GOOGLE DRIVE API PLACEHOLDER - ORGANIZATION PROFILE DOCUMENT / IMAGE]
    // Insert Google Drive API upload logic here to upload `documentForm.file`
    // to your Google Drive folder and pass the resulting `webViewLink` to
    // `addOfficerDocument({ ..., fileUrl: driveResponse.webViewLink })`.
    //
    //   ...
    //
    // =========================================================================

    const saved = await addOfficerDocument({
      organizationId: organization.id,
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

  const status = organization.accreditationStatus ?? organization.status
  const tabs = profileTabs.map((tab) => ({
    ...tab,
    active: activeTab === tab.key,
    count: { officers: executiveOfficers.length, events: upcomingEvents.length, documents: documents.length + (organization.documents?.length ?? 0) }[tab.key],
    onClick: () => setActiveTab(tab.key),
  }))

  const officerList = executiveOfficers.length ? (
    <div className="officer-org-officer-list">
      {executiveOfficers.map((member) => (
        <div className="officer-org-officer" key={member.id}>
          <span aria-hidden="true" className="officer-org-person-icon">{initials(formatDisplayName(member))}</span>
          <div><strong>{formatDisplayName(member)}</strong><small>{member.studentId} · {member.program || 'Student'}</small></div>
          <div className="officer-org-officer-meta"><Badge tone="crimson">{member.position}</Badge><Badge tone={statusTone(member.status)}>{member.status}</Badge></div>
        </div>
      ))}
    </div>
  ) : <EmptyState title="No executive officers recorded" />

  const documentList = documents.length || organization.documents?.length ? (
    <div className="officer-org-document-list">
      {(organization.documents ?? []).map((name) => (
        <div className="officer-org-document" key={`on-file-${name}`}>
          <span aria-hidden="true" className="officer-org-document-icon"><Icon name="document" /></span>
          <div><strong>{name}</strong><small>ORGANIZATION DOCUMENT · On file</small></div>
          <Badge tone="success">ON FILE</Badge>
        </div>
      ))}
      {documents.map((document) => (
        <div className="officer-org-document" key={document.id}>
          <span aria-hidden="true" className="officer-org-document-icon"><Icon name="document" /></span>
          <div><strong>{document.title}</strong><small>{document.type} · Submitted {document.submittedDate}</small></div>
          <Badge tone={statusTone(document.status)}>{document.status}</Badge>
        </div>
      ))}
    </div>
  ) : <EmptyState title="No organization documents" description="Upload a document to start an adviser review." />

  const eventList = upcomingEvents.length ? (
    <div className="officer-org-event-list">
      {upcomingEvents.map((event) => (
        <article className="officer-org-event" key={event.id}>
          <span aria-hidden="true" className="officer-org-event-icon"><Icon name="event" /></span>
          <div><strong>{event.title}</strong><small>{event.date} · {formatTime(event)} · {event.location || event.venue || 'Venue not set'}</small></div>
          <Badge tone={statusTone(event.status)}>{event.status.replaceAll('_', ' ')}</Badge>
        </article>
      ))}
    </div>
  ) : <EmptyState title="No upcoming approved events" description="Approved and published events will appear here." />

  const activityList = activities.length ? (
    <div className="officer-org-activity-list">
      {activities.map((activity) => (
        <article className="officer-org-activity" key={activity.id}>
          <span aria-hidden="true" className="officer-org-activity-dot" />
          <div><p>{activity.message}</p><small>{activity.time} · {activity.person}</small></div>
        </article>
      ))}
    </div>
  ) : <EmptyState title="No activity recorded" />

  return (
    <div className="officer-organization-profile fb-page">
      <ProfileCover
        actions={(
          <>
            <Button onClick={openEdit}><Icon name="edit" /> Edit Profile</Button>
            <Link className="button button-secondary" to="/officer/members">Members</Link>
          </>
        )}
        avatarText={organization.acronym}
        badges={(
          <>
            <Badge tone={statusTone(status)}>{status}</Badge>
            <Badge tone="crimson">{organization.category}</Badge>
          </>
        )}
        eyebrow={`${organization.category} · ${organization.acronym}`}
        label="Organization profile"
        logo={organization.logo}
        showCover={false}
        subtitle={<>{totalMembers} members <i aria-hidden="true">·</i> Faculty Adviser: <strong>{organization.adviser}</strong></>}
        tabs={tabs}
        tabsLabel="Organization profile sections"
        title={organization.name}
      />

      <div className="fb-body">
        <aside className="fb-side" aria-label="Organization intro">
          <Card className="fb-card">
            <SectionHeading title="Intro" />
            <p className="fb-intro-text">{organization.mission}</p>
            <ul className="fb-intro-list">
              <li><span aria-hidden="true"><Icon name="category" /></span><div>Category <strong>{organization.category}</strong></div></li>
              <li><span aria-hidden="true"><Icon name="members" /></span><div><strong>{officerMemberCount}</strong> active members</div></li>
              <li><span aria-hidden="true"><Icon name="requests" /></span><div><strong>{pendingRequests.length}</strong> pending requests</div></li>
              <li><span aria-hidden="true"><Icon name="adviser" /></span><div>Adviser <strong>{organization.adviser}</strong></div></li>
            </ul>
            <Button className="fb-wide-button" onClick={openEdit} variant="secondary">Edit details</Button>
          </Card>

          <Card className="fb-card">
            <SectionHeading action={<button className="fb-link-button" onClick={() => setActiveTab('officers')} type="button">See all</button>} title="Officers" />
            {executiveOfficers.length ? (
              <div className="fb-officer-grid">
                {executiveOfficers.slice(0, 6).map((member) => (
                  <Link className="fb-officer-tile" key={member.id} to="/officer/members">
                    <span aria-hidden="true">{initials(formatDisplayName(member))}</span>
                    <strong>{formatDisplayName(member).split(',')[0]}</strong>
                    <small>{member.position}</small>
                  </Link>
                ))}
              </div>
            ) : <EmptyState title="No executive officers recorded" />}
          </Card>

          <Card className="fb-card">
            <SectionHeading action={<button className="fb-link-button" onClick={() => setActiveTab('documents')} type="button">See all</button>} title="Documents" />
            <p className="fb-muted">{documents.length + (organization.documents?.length ?? 0)} files on record for this organization.</p>
            <Button className="fb-wide-button" onClick={() => { setFormError(''); setUploadOpen(true) }} variant="secondary"><Icon name="plus" /> Upload Document</Button>
          </Card>
        </aside>

        <div className="fb-feed">
          {activeTab === 'posts' && (
            <>
              <Card className="fb-card fb-composer">
                <div className="fb-composer-row">
                  <span aria-hidden="true" className="fb-mini-avatar">{(organization.acronym || 'ORG').slice(0, 3)}</span>
                  <Link className="fb-composer-input" to="/officer/announcements">Share an update with your members…</Link>
                </div>
                <div className="fb-composer-actions">
                  <Link to="/officer/announcements"><Icon name="announcement" /> Announcement</Link>
                  <Link to="/officer/events/create"><Icon name="event" /> Event</Link>
                  <button onClick={() => { setFormError(''); setUploadOpen(true) }} type="button"><Icon name="upload" /> Document</button>
                </div>
              </Card>

              {announcements.length ? announcements.slice(0, 4).map((announcement, index) => (
                <Card className="fb-card fb-post" key={`${announcement.title}-${index}`}>
                  <div className="fb-post-head">
                    <span aria-hidden="true" className="fb-mini-avatar">{(organization.acronym || 'ORG').slice(0, 3)}</span>
                    <div><strong>{organization.name}</strong><small>{announcement.date} · Announcement</small></div>
                  </div>
                  <h3>{announcement.title}</h3>
                  <p>{announcement.description || 'Official update shared with organization members.'}</p>
                  <div className="fb-post-foot"><Link to="/officer/announcements">Manage announcements <Icon name="arrow-right" size={13} /></Link></div>
                </Card>
              )) : (
                <Card className="fb-card"><EmptyState title="No announcements yet" description="Post an update for your organization members." /></Card>
              )}

              <Card className="fb-card">
                <SectionHeading title="Organization Activity" />
                {activityList}
              </Card>
            </>
          )}

          {activeTab === 'about' && (
            <Card className="fb-card">
              <SectionHeading title="About" action={<Button onClick={openEdit} variant="secondary">Edit Information</Button>} />
              <dl className="officer-org-info-grid">
                <div><dt>Official Name</dt><dd>{organization.name}</dd></div>
                <div><dt>Acronym</dt><dd>{organization.acronym}</dd></div>
                <div><dt>Category</dt><dd>{organization.category}</dd></div>
                <div><dt>Faculty Adviser</dt><dd>{organization.adviser}</dd><small>Adviser assignments are managed by Student Affairs.</small></div>
                <div className="officer-org-info-wide"><dt>Mission</dt><dd>{organization.mission}</dd></div>
                <div className="officer-org-info-wide"><dt>Vision</dt><dd>{organization.vision}</dd></div>
              </dl>
            </Card>
          )}

          {activeTab === 'officers' && (
            <Card className="fb-card">
              <SectionHeading title="Executive Officers" action={<Link className="officer-org-text-link" to="/officer/members">Manage Officers <Icon name="arrow-right" size={13} /></Link>} />
              {officerList}
            </Card>
          )}

          {activeTab === 'events' && (
            <Card className="fb-card">
              <SectionHeading title="Upcoming Events" action={<Link className="officer-org-text-link" to="/officer/events">View All Events <Icon name="arrow-right" size={13} /></Link>} />
              {eventList}
            </Card>
          )}

          {activeTab === 'documents' && (
            <Card className="fb-card">
              <SectionHeading title="Official Documents" action={<Link className="officer-org-text-link" to="/officer/documents">View Documents <Icon name="arrow-right" size={13} /></Link>} />
              {documentList}
              <Button className="officer-org-section-action" onClick={() => { setFormError(''); setUploadOpen(true) }} variant="secondary"><Icon name="plus" /> Upload Document</Button>
            </Card>
          )}
        </div>
      </div>

      <Modal onClose={() => setEditOpen(false)} open={editOpen} size="lg" title="Edit Organization Profile">
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

      <Modal onClose={() => setUploadOpen(false)} open={uploadOpen} size="md" title="Upload Organization Document">
        <form className="officer-org-form" onSubmit={uploadDocument}>
          <label>Document Name<input onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))} required value={documentForm.title} /></label>
          <label>Document Type<select onChange={(event) => setDocumentForm((current) => ({ ...current, type: event.target.value }))} value={documentForm.type}>{documentTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label>Choose File<input accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(event) => setDocumentForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} required type="file" /></label>
          <p className="officer-org-upload-note">Saves document metadata to PostgreSQL (`documents` table) and reserves a Google Drive API upload hook for `file_url`.</p>
          {formError && <p className="auth-error" role="alert">{formError}</p>}
          <div className="officer-org-modal-actions"><Button onClick={() => setUploadOpen(false)} variant="secondary">Cancel</Button><Button type="submit">Submit Document</Button></div>
        </form>
      </Modal>
    </div>
  )
}
