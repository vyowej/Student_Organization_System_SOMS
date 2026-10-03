import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { useToast } from '../components/ui/useToast.js'
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
    adminOrganizations,
    currentUser,
    saveOfficerAnnouncement,
    archiveOfficerAnnouncement,
    deleteOfficerAnnouncement,
  } = useOutletContext()
  const { showToast } = useToast()
  const organization = adminOrganizations.find((item) => item.id === currentUser?.organizationId)
  const announcements = organization?.announcements ?? emptyAnnouncements
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sortOrder, setSortOrder] = useState('newest')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingAnnouncement, setEditingAnnouncement] = useState(null)
  const [viewingAnnouncement, setViewingAnnouncement] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
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

  function save(status) {
    if (!form.title.trim() || !form.content.trim()) {
      setFormError('Title and content are required.')
      return
    }
    const saved = saveOfficerAnnouncement({
      id: editingAnnouncement?.id,
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
      : status === 'DRAFT' ? 'Announcement saved as draft.' : 'Announcement published successfully.', 'success')
  }

  function performConfirmedAction() {
    if (!confirmAction) return
    const { action, announcement } = confirmAction
    const completed = action === 'archive'
      ? archiveOfficerAnnouncement(announcement.id)
      : deleteOfficerAnnouncement(announcement.id)
    if (!completed) {
      showToast(`Unable to ${action} this announcement.`, 'error')
      return
    }
    showToast(action === 'archive' ? 'Announcement archived.' : 'Announcement deleted.', 'success')
    if (viewingAnnouncement?.id === announcement.id) setViewingAnnouncement(null)
    setConfirmAction(null)
  }

  return (
    <div className="officer-announcements-page">
      <PageHeader
        description="Create and manage announcements for your organization's members."
        eyebrow="ORGANIZATION COMMUNICATIONS"
        title="Announcements"
      />

      <div className="officer-announcements-toolbar">
        <div className="officer-announcements-filters">
          <label className="officer-announcements-search">
            <span aria-hidden="true">⌕</span>
            <input aria-label="Search announcements" onChange={(event) => setSearch(event.target.value)} placeholder="Search announcements" type="search" value={search} />
          </label>
          <label className="officer-announcements-filter">Status
            <select aria-label="Filter announcements by status" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              {statusOptions.map((status) => <option key={status} value={status}>{status === 'All' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}</option>)}
            </select>
          </label>
          <label className="officer-announcements-filter">Sort
            <select aria-label="Sort announcements" onChange={(event) => setSortOrder(event.target.value)} value={sortOrder}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </label>
        </div>
        <Button onClick={openCreate}>＋ Create Announcement</Button>
      </div>

      {filteredAnnouncements.length ? (
        <div className="officer-announcement-list">
          {filteredAnnouncements.map((announcement) => (
            <Card className="officer-announcement-card" key={announcement.id}>
              <div className="officer-announcement-card-header">
                <div className="officer-announcement-title">
                  <span aria-hidden="true" className="officer-announcement-mark">▤</span>
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
          <Button onClick={openCreate}>Create Announcement</Button>
        </Card>
      )}

      <Modal onClose={() => setEditorOpen(false)} open={editorOpen} title={editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}>
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

      <Modal onClose={() => setViewingAnnouncement(null)} open={Boolean(viewingAnnouncement)} title="Announcement Details">
        {viewingAnnouncement && <article className="officer-announcement-detail">
          <Badge tone={toneForStatus(viewingAnnouncement.status)}>{viewingAnnouncement.status}</Badge>
          <h2>{viewingAnnouncement.title}</h2>
          <p>{viewingAnnouncement.content}</p>
          <dl><div><dt>Posted by</dt><dd>{viewingAnnouncement.postedBy || formatDisplayName(currentUser)}</dd></div><div><dt>Date posted</dt><dd>{dateLabel(viewingAnnouncement.datePosted)}</dd></div><div><dt>Last updated</dt><dd>{dateLabel(viewingAnnouncement.lastUpdated ?? viewingAnnouncement.datePosted)}</dd></div></dl>
        </article>}
      </Modal>

      <Modal onClose={() => setConfirmAction(null)} open={Boolean(confirmAction)} title={confirmAction?.action === 'archive' ? 'Archive Announcement' : 'Delete Announcement'}>
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
