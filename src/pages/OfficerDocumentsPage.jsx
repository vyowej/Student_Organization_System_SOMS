import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Icon from '../components/ui/Icon.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'

const documentTypes = [
  'Constitution & By-Laws',
  'Accreditation Document',
  'Officer Roster',
  'Event Proposal',
  'Safety Plan',
  'Financial Statement',
  'Accomplishment Report',
  'Other',
]

const statusTone = {
  PENDING: 'warning',
  APPROVED: 'success',
  RETURNED: 'danger',
  REJECTED: 'danger',
}

export default function OfficerDocumentsPage() {
  const { addOfficerDocument, adminOrganizations = [], adviserDocuments = [], captureUndo, currentUser } = useOutletContext()
  const { showToast } = useToast()
  const orgId = currentUser?.organizationId || adminOrganizations[0]?.id
  const organization = adminOrganizations?.find((item) => String(item.id) === String(orgId)) || adminOrganizations[0] || { name: 'Your Organization', acronym: 'ORG' }

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [documentForm, setDocumentForm] = useState({ title: '', type: documentTypes[0], file: null })

  const orgDocuments = useMemo(
    () => adviserDocuments.filter((d) => !organization.id || String(d.organizationId) === String(organization.id)),
    [adviserDocuments, organization.id]
  )

  const counts = useMemo(() => {
    const total = orgDocuments.length
    const approved = orgDocuments.filter((d) => d.status === 'APPROVED').length
    const pending = orgDocuments.filter((d) => d.status === 'PENDING').length
    const returned = orgDocuments.filter((d) => ['RETURNED', 'REJECTED'].includes(d.status)).length
    return { total, approved, pending, returned }
  }, [orgDocuments])

  const visibleDocuments = useMemo(() => {
    return orgDocuments
      .filter((doc) => {
        if (statusFilter === 'APPROVED') return doc.status === 'APPROVED'
        if (statusFilter === 'PENDING') return doc.status === 'PENDING'
        if (statusFilter === 'RETURNED') return ['RETURNED', 'REJECTED'].includes(doc.status)
        return true
      })
      .filter((document) => matchesQuery(search, document.title, document.type, document.status, document.submittedDate))
  }, [orgDocuments, search, statusFilter])

  async function uploadDocument(event) {
    event.preventDefault()
    if (!documentForm.title.trim() || !documentForm.type || !documentForm.file) {
      setFormError('Enter a document name, choose a type, and select a file.')
      return
    }
    const undo = captureUndo()

    // =========================================================================
    // [GOOGLE DRIVE API PLACEHOLDER - OFFICER DOCUMENT / IMAGE UPLOAD]
    // Insert Google Drive API upload integration here for `documentForm.file`
    // and store the returned Google Drive `webViewLink` in `fileUrl` below.
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

  return (
    <div className="officer-page">
      <PageHeader
        description={`Track and upload compliance and official documents for ${organization.name}.`}
        eyebrow={organization.name}
        title="Organization Documents"
      />

      <div className="officer-stats-grid">
        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-crimson">
            <Icon name="document" size={18} />
          </div>
          <div>
            <span className="stat-value">{counts.total}</span>
            <span className="stat-label">Total Submissions</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-green">
            <Icon name="check-circle" size={18} />
          </div>
          <div>
            <span className="stat-value">{counts.approved}</span>
            <span className="stat-label">Approved & On File</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-gold">
            <Icon name="clock" size={18} />
          </div>
          <div>
            <span className="stat-value">{counts.pending}</span>
            <span className="stat-label">Pending Review</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-danger">
            <Icon name="alert-circle" size={18} />
          </div>
          <div>
            <span className="stat-value">{counts.returned}</span>
            <span className="stat-label">Action Required</span>
          </div>
        </Card>
      </div>

      <div className="officer-toolbar-tabs-row officer-announcements-toolbar">
        <div className="officer-request-tabs" role="group" aria-label="Filter documents by status">
          {[
            { key: 'ALL', label: 'All', count: counts.total },
            { key: 'APPROVED', label: 'Approved', count: counts.approved },
            { key: 'PENDING', label: 'Pending', count: counts.pending },
            { key: 'RETURNED', label: 'Returned', count: counts.returned },
          ].map((tab) => (
            <button
              aria-pressed={statusFilter === tab.key}
              className={statusFilter === tab.key ? 'is-selected' : ''}
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              type="button"
            >
              {tab.label} <span>{tab.count}</span>
            </button>
          ))}
        </div>
        <Button onClick={() => { setFormError(''); setUploadOpen(true) }}>
          <Icon name="plus" size={15} strokeWidth={2.2} />
          Upload Document
        </Button>
      </div>

      <SearchBar label="Search documents" onChange={setSearch} placeholder="Search documents by title, type, date, or status…" value={search} />

      <Card className="officer-page-card">
        <div className="officer-page-card-heading">
          <div>
            <h2>Document Submissions</h2>
            <p>Official records and compliance files for {organization.name}.</p>
          </div>
        </div>

        {visibleDocuments.length ? (
          <div className="officer-doc-list">
            {visibleDocuments.map((document) => (
              <article className="officer-doc-card" key={document.id}>
                <div className="officer-doc-icon-wrap">
                  <Icon name="document" size={20} />
                </div>
                <div className="officer-doc-main">
                  <div className="officer-doc-header">
                    <span className="officer-doc-type-badge">{document.type}</span>
                    <Badge tone={statusTone[document.status] ?? 'neutral'}>{document.status}</Badge>
                  </div>
                  <h3>{document.title}</h3>
                  <p>Submitted on {document.submittedDate} · {document.processedBy ? `Reviewed by ${document.processedBy}` : 'Awaiting adviser review'}</p>
                  {document.decisionReason && (
                    <div className="officer-doc-feedback">
                      <strong>Adviser Feedback:</strong> {document.decisionReason}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState description={search ? 'No documents match your search.' : 'There are no document submissions matching this filter.'} title="No documents found" />
        )}
      </Card>

      <Modal onClose={() => setUploadOpen(false)} open={uploadOpen} title="Upload Organization Document">
        <form className="officer-org-form" onSubmit={uploadDocument}>
          <label>Document Name<input onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))} required value={documentForm.title} /></label>
          <label>Document Type<select onChange={(event) => setDocumentForm((current) => ({ ...current, type: event.target.value }))} value={documentForm.type}>{documentTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
          <label>Choose File<input accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(event) => setDocumentForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))} required type="file" /></label>
          <p className="officer-org-upload-note">Records the document in the PostgreSQL `documents` table and reserves a Google Drive API upload hook for `file_url`.</p>
          {formError && <p className="auth-error" role="alert">{formError}</p>}
          <div className="officer-org-modal-actions">
            <Button onClick={() => setUploadOpen(false)} variant="secondary">Cancel</Button>
            <Button type="submit">Submit Document</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
