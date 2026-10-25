import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import ConfirmDialog from '../components/ui/ConfirmDialog.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'
import { formatDisplayName } from '../data/displayName.js'

const statusOptions = ['All', 'PUBLISHED', 'DRAFT', 'ARCHIVED']
const emptyAnnouncements = []

function toneForStatus(status) {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'DRAFT') return 'warning'
  return 'neutral'
}

function dateLabel(value) {
  if (!value) return 'Not posted'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

export default function OfficerAnnouncementsPage() {
  const {
    adminOrganizations = [],
    captureUndo,
    currentUser,
    saveOfficerAnnouncement,
    archiveOfficerAnnouncement,
    deleteOfficerAnnouncement,
  } = useOutletContext()
  const { showToast } = useToast()
  const organization = adminOrganizations.find((item) => String(item.id) === String(currentUser?.organizationId)) || adminOrganizations[0]
  const announcements = organization?.announcements ?? emptyAnnouncements
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortOrder, setSortOrder] = useState('newest')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState(null)
  const [viewingAnnouncement, setViewingAnnouncement] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({ title: '', content: '' })

  const filteredAnnouncements = useMemo(() => {
    const query = search.trim().toLowerCase()
    return announcements
      .filter((item) => statusFilter === 'All' || item.status === statusFilter)
      .filter((item) => !query || `${item.title} ${item.content} ${item.postedBy}`.toLowerCase().includes(query))
      .sort((first, second) => {
        const firstDate = Date.parse(first.lastUpdated ?? first.datePosted ?? '') || 0
        const secondDate = Date.parse(second.lastUpdated ?? second.datePosted ?? '') || 0
        return sortOrder === 'newest' ? secondDate - firstDate : firstDate - secondDate
      })
  }, [announcements, search, sortOrder, statusFilter])

  function openCreate() {
    setEditingAnnouncement(null)
    setForm({ title: '', content: '' })
    setFormError('')
    setEditorOpen(true)
  }

  function openEdit(announcement) {
    setEditingAnnouncement(announcement)
    setForm({ title: announcement.title, content: announcement.content })
    setFormError('')
    setEditorOpen(true)
  }

  async function save(status, confirmed = false) {
    if (!form.title.trim() || !form.content.trim()) {
      setFormError('Title and content are required.')
      return
    }
    if (status === 'PUBLISHED' && !confirmed) {
      setPublishConfirmOpen(true)
      return
    }
    setPublishConfirmOpen(false)
    const undo = captureUndo()
    const saved = await saveOfficerAnnouncement({
      id: editingAnnouncement?.id,
      organizationId: organization?.id,
      title: form.title,
      content: form.content,
      status,
    })
    if (!saved) {
      setFormError('The announcement could not be saved. Verify your officer access and try again.')
      return
    }
    setEditorOpen(false)
    showToast(editingAnnouncement
      ? 'Announcement updated successfully.'
      : status === 'DRAFT' ? 'Announcement saved as draft.' : 'Announcement published successfully.', 'success', undoAction(undo))
  }

  async function performConfirmedAction() {
    if (!confirmAction) return
    const { action, announcement } = confirmAction
    const undo = captureUndo()
    const completed = action === 'archive'
      ? await archiveOfficerAnnouncement(announcement.id)
      : await deleteOfficerAnnouncement(announcement.id)
    if (!completed) {
      showToast(`Unable to ${action} this announcement.`, 'error')
      return
    }
    showToast(action === 'archive' ? 'Announcement archived.' : 'Announcement deleted.', 'success', undoAction(undo))
    if (viewingAnnouncement?.id === announcement.id) setViewingAnnouncement(null)
    setConfirmAction(null)
  }

  const counts = useMemo(() => {
    const total = announcements.length
    const published = announcements.filter((a) => a.status === 'PUBLISHED').length
    const drafts = announcements.filter((a) => a.status === 'DRAFT').length
    const archived = announcements.filter((a) => a.status === 'ARCHIVED').length
    return { total, published, drafts, archived }
  }, [announcements])

  return (
    <div className="officer-announcements-page">
      <PageHeader
        description={`Create and manage announcements for ${organization?.name || 'your organization'}'s members.`}
        eyebrow={organization?.name || 'ORGANIZATION COMMUNICATIONS'}
        title="Announcements"
      />

      <div className="officer-stats-grid">
        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-crimson">
            <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
              <path d="m3 11 18-5v12L3 14v-3z" />
              <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
            </svg>
          </div>
          <div>
            <span className="stat-value">{counts.total}</span>
            <span className="stat-label">Total Announcements</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-green">
            <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <span className="stat-value">{counts.published}</span>
            <span className="stat-label">Published to Members</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-gold">
            <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" x2="8" y1="13" y2="13" />
            </svg>
          </div>
          <div>
            <span className="stat-value">{counts.drafts}</span>
            <span className="stat-label">Saved Drafts</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-blue">
            <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect height="5" width="22" x="1" y="3" />
              <line x1="10" x2="14" y1="12" y2="12" />
            </svg>
          </div>
          <div>
            <span className="stat-value">{counts.archived}</span>
            <span className="stat-label">Archived</span>
          </div>
        </Card>
      </div>

      <div className="officer-announcements-toolbar" style={{ marginTop: '12px', marginBottom: '8px' }}>
        <div className="officer-announcements-filters">
          <label className="officer-announcements-filter officer-announcements-filter-search">
            <span>Search</span>
            <div className="officer-announcements-search">
              <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" x2="16.65" y1="21" y2="16.65" />
              </svg>
              <input aria-label="Search announcements" onChange={(event) => setSearch(event.target.value)} placeholder="Search announcements..." type="search" value={search} />
            </div>
          </label>
          <label className="officer-announcements-filter">
            <span>Status</span>
            <select aria-label="Filter announcements by status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              {statusOptions.map((status) => <option key={status} value={status}>{status === 'All' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}</option>)}
            </select>
          </label>
          <label className="officer-announcements-filter">
            <span>Sort</span>
            <select aria-label="Sort announcements" onChange={(event) => setSortOrder(event.target.value)} value={sortOrder}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>
        </div>
        <Button className="officer-announcements-create-btn" onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="15">
            <line x1="12" x2="12" y1="5" y2="19" />
            <line x1="5" x2="19" y1="12" y2="12" />
          </svg>
          Create Announcement
        </Button>
      </div>

      {filteredAnnouncements.length ? (
        <div className="officer-announcement-list">
          {filteredAnnouncements.map((announcement) => (
            <Card className="officer-announcement-card" key={announcement.id}>
              <div className="officer-announcement-card-header">
                <div className="officer-announcement-title">
                  <span aria-hidden="true" className="officer-announcement-mark">
                    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
                      <path d="m3 11 18-5v12L3 14v-3z" />
                      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
                    </svg>
                  </span>
                  <div><h2>{announcement.title}</h2><Badge tone={toneForStatus(announcement.status)}>{announcement.status}</Badge></div>
                </div>
                <span className="officer-announcement-date">{announcement.status === 'PUBLISHED' ? 'Published' : 'Created'} · {dateLabel(announcement.datePosted)}</span>
              </div>
              <p className="officer-announcement-preview">{announcement.content}</p>
              <div className="officer-announcement-footer">
                <span>Posted by <strong>{announcement.postedBy || formatDisplayName(currentUser)}</strong></span>
                <span>Last updated <strong>{dateLabel(announcement.lastUpdated ?? announcement.datePosted)}</strong></span>
                <div className="officer-announcement-actions">
                  <Button onClick={() => setViewingAnnouncement(announcement)} variant="ghost">View</Button>
                  <Button onClick={() => openEdit(announcement)} variant="secondary">Edit</Button>
                  {announcement.status !== 'ARCHIVED' && <Button onClick={() => setConfirmAction({ action: 'archive', announcement })} variant="secondary">Archive</Button>}
                  <Button onClick={() => setConfirmAction({ action: 'delete', announcement })} variant="danger">Delete</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : announcements.length ? (
        <EmptyState title="No matching announcements" description="Try another search term or status filter." />
      ) : (
        <Card className="officer-announcements-empty">
          <EmptyState title="No announcements yet" description="Create your first announcement to keep your organization members informed." />
          <Button onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="15">
              <line x1="12" x2="12" y1="5" y2="19" />
              <line x1="5" x2="19" y1="12" y2="12" />
            </svg>
            Create Announcement
          </Button>
        </Card>
      )}

      <ConfirmDialog
        confirmLabel="Publish announcement"
        message={`Are you sure you want to publish "${form.title.trim()}"? Members of your organization will be able to see it.`}
        onCancel={() => setPublishConfirmOpen(false)}
        onConfirm={() => save('PUBLISHED', true)}
        open={editorOpen && publishConfirmOpen}
        title="Publish announcement"
      />

      <Modal onClose={() => setEditorOpen(false)} open={editorOpen && !publishConfirmOpen} size="lg" title={editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}>
        <form className="officer-announcement-form" onSubmit={(event) => { event.preventDefault(); save('PUBLISHED') }}>
          <label>Title<input autoFocus onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required value={form.title} /></label>
          <label>Description / Content<textarea onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} required rows="7" value={form.content} /></label>
          {formError && <p className="auth-error" role="alert">{formError}</p>}
          <div className="officer-announcement-modal-actions">
            <Button onClick={() => setEditorOpen(false)} variant="secondary">Cancel</Button>
            <Button onClick={() => save('DRAFT')} type="button" variant="secondary">Save Draft</Button>
            <Button type="submit">{editingAnnouncement ? 'Save Changes & Publish' : 'Publish'}</Button>
          </div>
        </form>
      </Modal>

      <Modal onClose={() => setViewingAnnouncement(null)} open={Boolean(viewingAnnouncement)} size="md" title="Announcement Details">
        {viewingAnnouncement && <article className="officer-announcement-detail">
          <Badge tone={toneForStatus(viewingAnnouncement.status)}>{viewingAnnouncement.status}</Badge>
          <h2>{viewingAnnouncement.title}</h2>
          <p>{viewingAnnouncement.content}</p>
          <dl><div><dt>Posted by</dt><dd>{viewingAnnouncement.postedBy || formatDisplayName(currentUser)}</dd></div><div><dt>Date posted</dt><dd>{dateLabel(viewingAnnouncement.datePosted)}</dd></div><div><dt>Last updated</dt><dd>{dateLabel(viewingAnnouncement.lastUpdated ?? viewingAnnouncement.datePosted)}</dd></div></dl>
        </article>}
      </Modal>

      <Modal onClose={() => setConfirmAction(null)} open={Boolean(confirmAction)} size="sm" title={confirmAction?.action === 'archive' ? 'Archive Announcement' : 'Delete Announcement'}>
        {confirmAction && <>
          <p>{confirmAction.action === 'archive'
            ? `Archive "${confirmAction.announcement.title}"? It will no longer appear as an active student announcement.`
            : `Delete "${confirmAction.announcement.title}"? This action cannot be undone.`}</p>
          <div className="officer-announcement-modal-actions">
            <Button onClick={() => setConfirmAction(null)} variant="secondary">Cancel</Button>
            <Button onClick={performConfirmedAction} variant={confirmAction.action === 'delete' ? 'danger' : 'primary'}>{confirmAction.action === 'archive' ? 'Archive' : 'Delete Announcement'}</Button>
          </div>
        </>}
      </Modal>
    </div>
  )
}
