import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import AdviserReviewDialog from '../components/adviser/AdviserReviewDialog.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import SearchBar, { matchesQuery } from '../components/ui/SearchBar.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'

const filters = ['All', 'Pending', 'Approved', 'Returned', 'Rejected']
const badgeTone = { PENDING: 'warning', SUBMITTED: 'warning', UNDER_REVIEW: 'warning', APPROVED: 'success', VERIFIED: 'success', RETURNED: 'danger', RETURNED_FOR_REVISION: 'danger', REJECTED: 'danger', PENDING_VERIFICATION: 'warning' }
const approvedStatuses = ['APPROVED', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'ARCHIVED', 'VERIFIED']

export default function AdviserApprovalsPage() {
  const { adviserDocuments, adviserReports, captureUndo, officerEvents, reviewAccomplishmentReport, reviewAdviserRequest } = useOutletContext()
  const { showToast } = useToast()
  const [filter, setFilter] = useState('Pending')
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const events = officerEvents.map((event) => ({ ...event, type: 'EVENT', title: event.title, submittedDate: event.submittedDate ?? 'October 2, 2026' }))
  const documents = adviserDocuments.map((document) => ({ ...document, type: document.type || 'DOCUMENT' }))
  const reports = adviserReports.map((report) => ({ ...report, type: 'ACCOMPLISHMENT_REPORT', title: report.eventTitle, submittedDate: report.submittedDate }))
  const items = [...events, ...documents, ...reports].filter((item) => (
    item.type === 'EVENT' ? item.status !== 'DRAFT'
      : item.type === 'ACCOMPLISHMENT_REPORT' ? item.status !== 'DRAFT'
        : true
  ))

  function matchesFilter(item) {
    if (filter === 'All') return true
    if (filter === 'Pending') return ['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'PENDING_VERIFICATION'].includes(item.status)
    if (filter === 'Returned') return ['RETURNED', 'RETURNED_FOR_REVISION'].includes(item.status)
    if (filter === 'Approved') return approvedStatuses.includes(item.status)
    return item.status === filter.toUpperCase()
  }

  function decide(decision, comment) {
    if (!selected) return
    const undo = captureUndo()
    const success = selected.type === 'ACCOMPLISHMENT_REPORT'
      ? reviewAccomplishmentReport(selected.id, decision === 'VERIFIED' ? 'VERIFIED' : decision, comment)
      : reviewAdviserRequest(selected.type === 'EVENT' ? 'EVENT' : 'DOCUMENT', selected.id, decision, comment)
    if (success) {
      const message = decision === 'APPROVED' ? 'Request approved successfully.'
        : decision === 'VERIFIED' ? `${selected.title} report was verified.`
          : decision === 'REJECTED' ? `${selected.title} was rejected.`
            : `${selected.title} was returned for revision.`
      showToast(message, 'success', undoAction(undo))
    } else {
      showToast('The decision could not be saved. Refresh the page and try again.', 'error')
    }
    return success
  }

  const visibleItems = items
    .filter(matchesFilter)
    .filter((item) => matchesQuery(search, item.title, item.type, item.organizationName, item.submittedDate))

  return (
    <>
      <PageHeader
        description="Review submissions from organizations assigned to you. Your decisions are recorded for the officer."
        eyebrow="UNIDOS · FACULTY ADVISER"
        title="Adviser Approvals"
      />
      <SearchBar label="Search approvals" onChange={setSearch} placeholder="Search submissions by title, type or organization…" value={search} />
      <Card className="adviser-panel adviser-approvals-panel">
        <div className="adviser-filter-row" aria-label="Filter approvals" role="group">
          {filters.map((item) => {
            const count = items.filter((entry) => {
              if (item === 'All') return true
              if (item === 'Pending') return ['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'PENDING_VERIFICATION'].includes(entry.status)
              if (item === 'Returned') return ['RETURNED', 'RETURNED_FOR_REVISION'].includes(entry.status)
              if (item === 'Approved') return approvedStatuses.includes(entry.status)
              return entry.status === item.toUpperCase()
            }).length
            return <button aria-pressed={filter === item} className={filter === item ? 'is-active' : ''} key={item} onClick={() => setFilter(item)} type="button">{item}<span>{count}</span></button>
          })}
        </div>
        {visibleItems.length ? (
          <div className="adviser-submission-list">
            {visibleItems.map((item) => (
              <article className="adviser-submission-card" key={`${item.type}-${item.id}`}>
                <div className="adviser-submission-info">
                  <span className="adviser-muted-label">{item.organizationName ?? 'WMSU Computer Society'} · {item.type.replaceAll('_', ' ')}</span>
                  <h2>{item.title}</h2>
                  <p>Submitted by {item.submittedBy ?? 'Organization Officer'} · {item.submittedDate}</p>
                  {(item.revisionNote || item.decisionReason) && <small>Feedback: {item.revisionNote ?? item.decisionReason}</small>}
                </div>
                <Badge tone={badgeTone[item.status] ?? 'neutral'}>{item.status.replaceAll('_', ' ')}</Badge>
                <Button onClick={() => setSelected(item)} variant="secondary">View</Button>
              </article>
            ))}
          </div>
        ) : <EmptyState description={`No ${filter.toLowerCase()} submissions from assigned organizations.`} title="Nothing to review" />}
      </Card>
      <AdviserReviewDialog
        approvalConfirmationLabel="Yes, Approve"
        approvalConfirmationMessage="Are you sure you want to approve this request? Please review the details before proceeding."
        approvalConfirmationTitle="Confirm Approval"
        item={selected}
        key={selected?.id ?? 'closed'}
        onClose={() => setSelected(null)}
        onDecision={decide}
        report={selected?.type === 'ACCOMPLISHMENT_REPORT'}
      />
    </>
  )
}
