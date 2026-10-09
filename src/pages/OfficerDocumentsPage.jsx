import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'

const statusTone = { PENDING: 'warning', APPROVED: 'success', RETURNED: 'danger', REJECTED: 'danger' }

export default function OfficerDocumentsPage() {
  const { adviserDocuments } = useOutletContext()
  const [search, setSearch] = useState('')
  const documents = adviserDocuments.filter((document) => matchesQuery(search, document.title, document.type, document.status, document.submittedDate))

  return (
    <>
      <PageHeader
        description="Track documents submitted for your organization's adviser review."
        eyebrow="WMSU COMPUTER SOCIETY"
        title="Organization Documents"
      />
      <SearchBar label="Search documents" onChange={setSearch} placeholder="Search documents by title, type or status…" value={search} />
      <Card className="adviser-panel">
        <div className="adviser-panel-heading"><div><h2>Document Submissions</h2><p>Only WMSU Computer Society records are displayed in this officer workspace.</p></div></div>
        {documents.length ? <div className="adviser-submission-list">
          {documents.map((document) => (
            <article className="adviser-submission-card" key={document.id}>
              <div className="adviser-submission-info"><span className="adviser-muted-label">{document.type}</span><h2>{document.title}</h2><p>Submitted {document.submittedDate} · Adviser review</p>
                {document.decisionReason && <small>Adviser feedback: {document.decisionReason}</small>}
              </div>
              <Badge tone={statusTone[document.status] ?? 'neutral'}>{document.status}</Badge>
              <span className="adviser-readonly-status">{document.processedBy ? `Reviewed by ${document.processedBy}` : 'Awaiting adviser review'}</span>
            </article>
          ))}
        </div> : <EmptyState description={search ? 'No documents match your search.' : 'There are no document submissions.'} title="No documents" />}
      </Card>
    </>
  )
}
