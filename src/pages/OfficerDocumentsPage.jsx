import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'

const statusTone = { PENDING: 'warning', APPROVED: 'success', RETURNED: 'danger', REJECTED: 'danger' }

export default function OfficerDocumentsPage() {
  const { adviserDocuments } = useOutletContext()

  return (
    <>
      <PageHeader
        description="Track documents submitted for your organization's adviser review."
        eyebrow="WMSU COMPUTER SOCIETY"
        title="Organization Documents"
      />
      <Card className="adviser-panel">
        <div className="adviser-panel-heading"><div><h2>Document Submissions</h2><p>Only WMSU Computer Society records are displayed in this officer workspace.</p></div></div>
        {adviserDocuments.length ? <div className="adviser-submission-list">
          {adviserDocuments.map((document) => (
            <article className="adviser-submission-card" key={document.id}>
              <div className="adviser-submission-info"><span className="adviser-muted-label">{document.type}</span><h2>{document.title}</h2><p>Submitted {document.submittedDate} · Adviser review</p>
                {document.decisionReason && <small>Adviser feedback: {document.decisionReason}</small>}
              </div>
              <Badge tone={statusTone[document.status] ?? 'neutral'}>{document.status}</Badge>
              <span className="adviser-readonly-status">{document.processedBy ? `Reviewed by ${document.processedBy}` : 'Awaiting adviser review'}</span>
            </article>
          ))}
        </div> : <EmptyState description="There are no document submissions." title="No documents" />}
      </Card>
    </>
  )
}
