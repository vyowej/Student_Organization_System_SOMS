import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
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
  const { addOfficerDocument, adminOrganizations, adviserDocuments, captureUndo, currentUser } = useOutletContext()
  const { showToast } = useToast()
  const orgId = currentUser?.organizationId || 'wmsu-cs'
  const organization = adminOrganizations?.find((item) => item.id === orgId) || { name: 'WMSU Computer Society', acronym: 'CS' }

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [documentForm, setDocumentForm] = useState({ title: '', type: documentTypes[0], file: null })

  const counts = useMemo(() => {
    const total = adviserDocuments.length
    const approved = adviserDocuments.filter((d) => d.status === 'APPROVED').length
    const pending = adviserDocuments.filter((d) => d.status === 'PENDING').length
    const returned = adviserDocuments.filter((d) => ['RETURNED', 'REJECTED'].includes(d.status)).length
    return { total, approved, pending, returned }
  }, [adviserDocuments])

  const visibleDocuments = useMemo(() => {
    return adviserDocuments
      .filter((doc) => {
        if (statusFilter === 'APPROVED') return doc.status === 'APPROVED'
        if (statusFilter === 'PENDING') return doc.status === 'PENDING'
        if (statusFilter === 'RETURNED') return ['RETURNED', 'REJECTED'].includes(doc.status)
        return true
      })
      .filter((document) => matchesQuery(search, document.title, document.type, document.status, document.submittedDate))
  }, [adviserDocuments, search, statusFilter])

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
    <div className="officer-page">
      <PageHeader
        description={`Track and upload compliance and official documents for ${organization.name}.`}
        eyebrow={organization.name}
        title="Organization Documents"
      />

      <div className="officer-stats-grid">
        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-crimson">
            <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <span className="stat-value">{counts.total}</span>
            <span className="stat-label">Total Submissions</span>
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
            <span className="stat-value">{counts.approved}</span>
            <span className="stat-label">Approved & On File</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-gold">
            <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <span className="stat-value">{counts.pending}</span>
            <span className="stat-label">Pending Review</span>
          </div>
        </Card>

        <Card className="officer-stat-card">
          <div className="officer-stat-icon tone-danger">
            <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          </div>
          <div>
            <span className="stat-value">{counts.returned}</span>
            <span className="stat-label">Action Required</span>
          </div>
        </Card>
      </div>

      <div className="officer-announcements-toolbar" style={{ marginTop: '12px', marginBottom: '8px' }}>
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
        <Button onClick={() => { setFormError(''); setUploadOpen(true) }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <svg aria-hidden="true" fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="15">
            <line x1="12" x2="12" y1="5" y2="19" />
            <line x1="5" x2="19" y1="12" y2="12" />
          </svg>
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
                  <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" x2="8" y1="13" y2="13" />
                    <line x1="16" x2="8" y1="17" y2="17" />
                  </svg>
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
          <p className="officer-org-upload-note">This frontend preview records the file name and submits the document metadata for adviser review. File storage will require a backend.</p>
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
