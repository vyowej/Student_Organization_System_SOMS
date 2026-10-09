import { useState } from 'react'
import Badge from '../ui/Badge.jsx'
import Button from '../ui/Button.jsx'
import ConfirmDialog from '../ui/ConfirmDialog.jsx'
import Modal from '../ui/Modal.jsx'

const statusTone = {
  PENDING: 'warning',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  VERIFIED: 'success',
  RETURNED: 'danger',
  RETURNED_FOR_REVISION: 'danger',
  REJECTED: 'danger',
  PENDING_VERIFICATION: 'warning',
}

export default function AdviserReviewDialog({
  item,
  onClose,
  onDecision,
  report = false,
  initialDecision = '',
  verifiedBy,
  turnout,
  approvalConfirmationTitle = 'Confirm Event Approval',
  approvalConfirmationMessage = 'Are you sure you want to approve this event proposal? Please review the event details before proceeding.',
  approvalConfirmationLabel = 'Yes, Approve Event',
}) {
  const [decision, setDecision] = useState(initialDecision)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [approvalConfirmationOpen, setApprovalConfirmationOpen] = useState(false)
  const [approvalProcessing, setApprovalProcessing] = useState(false)

  function close() {
    setDecision('')
    setComment('')
    setError('')
    setApprovalConfirmationOpen(false)
    setApprovalProcessing(false)
    onClose()
  }

  function requestDecision(nextDecision) {
    setDecision(nextDecision)
    setError('')
    setApprovalConfirmationOpen(true)
  }

  function confirmDecision() {
    if (approvalProcessing) return
    if (decision === 'RETURNED' || decision === 'REJECTED') {
      if (!comment.trim()) {
        setError(decision === 'REJECTED' ? 'Enter a reason before rejecting this submission.' : 'Enter revision comments before returning this submission.')
        return
      }
    }
    setApprovalProcessing(true)
    const saved = onDecision(decision, comment)
    if (saved) close()
    else setApprovalProcessing(false)
  }

  function confirmationCopy() {
    if (decision === 'APPROVED') {
      return {
        title: approvalConfirmationTitle,
        message: approvalConfirmationMessage,
        label: approvalConfirmationLabel,
        icon: '?',
      }
    }
    if (decision === 'VERIFIED') {
      return {
        title: 'Confirm Report Verification',
        message: 'Are you sure you want to verify this accomplishment report? Please make sure you have reviewed all the report details and supporting documents before proceeding.',
        label: 'Yes, Verify Report',
        icon: '!',
      }
    }
    if (decision === 'REJECTED') {
      return {
        title: 'Confirm Rejection',
        message: 'Are you sure you want to reject this request? Please review the details and provide a reason before proceeding.',
        label: 'Yes, Reject',
        icon: '!',
      }
    }
    return {
      title: 'Confirm Return for Revision',
      message: 'Are you sure you want to return this request for revision? Please review the details and provide feedback before proceeding.',
      label: 'Yes, Return for Revision',
      icon: '!',
    }
  }

  const confirmation = confirmationCopy()

  return (
    <>
      <Modal onClose={close} open={Boolean(item)} title={report ? 'Accomplishment Report' : 'Submission Review'}>
        {item && (
          <div className={`adviser-review-dialog${report ? ' adviser-review-dialog--report' : ''}`}>
          <div className="adviser-review-summary">
            <div>
              <span className="adviser-muted-label">{item.organizationName}</span>
              <h3>{item.title ?? item.eventTitle}</h3>
            </div>
            <Badge tone={statusTone[item.status] ?? 'neutral'}>{item.status.replaceAll('_', ' ')}</Badge>
          </div>
          {report ? (
            <>
              <section className="adviser-report-detail-section">
                <h4>Activity Information</h4>
                <dl className="adviser-review-facts adviser-report-detail-facts">
                  <div><dt>Activity title</dt><dd>{item.eventTitle ?? item.title}</dd></div>
                  <div><dt>Organization</dt><dd>{item.organizationName ?? 'Not provided'}</dd></div>
                  <div><dt>Date</dt><dd>{item.eventDate ?? item.date ?? 'Not provided'}</dd></div>
                  <div><dt>Time</dt><dd>{item.time ?? 'Not provided'}</dd></div>
                  <div><dt>Venue</dt><dd>{item.venue ?? item.location ?? 'Not provided'}</dd></div>
                  <div><dt>Submitted</dt><dd>{item.submittedDate ?? item.submissionDate ?? 'Not recorded'}</dd></div>
                </dl>
                <p>{item.description ?? 'No activity description was provided.'}</p>
              </section>
              <section className="adviser-report-detail-section">
                <h4>Attendance Summary</h4>
                <div className="adviser-report-attendance-grid">
                  {[
                    ['Registered', turnout?.registered],
                    ['Actual attendees', turnout?.attendees ?? item.actualAttendees ?? item.attendance],
                    ['No-shows', turnout?.noShows ?? item.noShows],
                    ['Turnout rate', turnout?.rate ?? item.turnoutRate],
                  ].map(([label, value]) => (
                    <div className="adviser-report-attendance-stat" key={label}><span>{label}</span><strong>{value === undefined || value === null || value === '' ? 'Not recorded' : value}</strong></div>
                  ))}
                </div>
              </section>
              <section className="adviser-report-detail-section">
                <h4>Accomplishment</h4>
                {[
                  ['Objectives', item.objectives],
                  ['Activities conducted', item.activitiesConducted ?? item.activities],
                  ['Results / Outcomes', item.results ?? item.outcomes],
                  ['Problems encountered', item.problemsEncountered ?? item.problems],
                  ['Recommendations', item.recommendations],
                ].map(([heading, value]) => (
                  <div className="adviser-report-narrative" key={heading}><h5>{heading}</h5><p>{Array.isArray(value) ? value.join(', ') : value || 'Not provided.'}</p></div>
                ))}
              </section>
              <section className="adviser-report-detail-section">
                <h4>Supporting Documents</h4>
                {item.supportingDocuments?.length
                  ? <div className="adviser-report-files">{item.supportingDocuments.map((file, index) => {
                    const fileName = typeof file === 'string' ? file : file.name ?? file.title ?? `Supporting document ${index + 1}`
                    return <div className="adviser-report-file-card" key={`${fileName}-${index}`}><span aria-hidden="true">▤</span><span><strong>{fileName}</strong><small>{file.type ?? 'Supporting document'}</small></span></div>
                  })}</div>
                  : <p>No supporting documents attached.</p>}
              </section>
              {item.status === 'VERIFIED' && (
                <section className="adviser-report-verification">
                  <strong><span aria-hidden="true">✓</span> Verified</strong>
                  <p>Verified by <b>{item.verifiedBy ?? verifiedBy ?? 'Assigned adviser'}</b></p>
                  <p>Verified on <b>{item.decisionDate ?? 'Date not recorded'}</b></p>
                </section>
              )}
            </>
          ) : (
            <>
              <dl className="adviser-review-facts">
                <div><dt>Request type</dt><dd>{item.type?.replaceAll('_', ' ') ?? 'EVENT'}</dd></div>
                <div><dt>Submitted by</dt><dd>{item.submittedBy ?? 'Organization Officer'}</dd></div>
                <div><dt>Submitted</dt><dd>{item.submittedDate ?? item.submissionDate ?? 'Not recorded'}</dd></div>
                {item.eventDate && <div><dt>Event date</dt><dd>{item.eventDate}</dd></div>}
                {item.date && <div><dt>Event date</dt><dd>{item.date}</dd></div>}
                {item.time && <div><dt>Time</dt><dd>{item.time}</dd></div>}
                {(item.venue || item.location) && <div><dt>Venue</dt><dd>{item.venue ?? item.location}</dd></div>}
                {item.targetAudience && <div><dt>Target audience</dt><dd>{item.targetAudience}</dd></div>}
                {item.attendance !== undefined && <div><dt>Attendance</dt><dd>{item.attendance}</dd></div>}
                {item.capacity !== undefined && <div><dt>Capacity</dt><dd>{item.capacity}</dd></div>}
                {item.registrationDeadline && <div><dt>Registration deadline</dt><dd>{item.registrationDeadline}</dd></div>}
                {item.budget && <div><dt>Budget</dt><dd>{item.budget}</dd></div>}
                {item.adviserDecisionDate && <div><dt>Decision date</dt><dd>{item.adviserDecisionDate}</dd></div>}
              </dl>
              <section><h4>Description</h4><p>{item.description ?? 'No description was provided.'}</p></section>
              <section>
                <h4>Supporting documents</h4>
                {item.supportingDocuments?.length ? <ul>{item.supportingDocuments.map((file) => <li key={file}>{file}</li>)}</ul> : <p>No supporting documents attached.</p>}
              </section>
            </>
          )}
          {(item.revisionNote || item.decisionReason) && (
            <p className="adviser-revision-note"><strong>Previous feedback:</strong> {item.revisionNote ?? item.decisionReason}</p>
          )}

          {item.status === 'PENDING_VERIFICATION' || (report && item.status === 'RETURNED') || ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'].includes(item.status) ? (
            <>
              <div className="adviser-review-actions">
                {report ? (
                  <>
                    <Button onClick={() => requestDecision('RETURNED')} variant="secondary">Return for Revision</Button>
                    <Button onClick={() => requestDecision('VERIFIED')} variant="primary">Verify Report</Button>
                  </>
                ) : (
                  <>
                    <Button onClick={() => requestDecision('REJECTED')} variant="danger">Reject</Button>
                    <Button onClick={() => requestDecision('RETURNED')} variant="secondary">Return for Revision</Button>
                    <Button onClick={() => requestDecision('APPROVED')} variant="primary">Approve</Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="adviser-review-actions"><Button onClick={close} variant="secondary">Close</Button></div>
          )}
          </div>
        )}
      </Modal>
      <ConfirmDialog
        confirmDisabled={approvalProcessing}
        confirmLabel={approvalProcessing ? 'Processing…' : confirmation.label}
        details={(
          <div className="adviser-action-confirmation">
            <span aria-hidden="true" className="adviser-verification-confirmation-icon">{confirmation.icon}</span>
            <div>
              <p>{confirmation.message}</p>
              {(decision === 'RETURNED' || decision === 'REJECTED') && (
                <div className="form-field adviser-review-comment">
                  <label htmlFor="adviser-review-comment">{decision === 'REJECTED' ? 'Rejection reason (required)' : 'Revision comments (required)'}</label>
                  <textarea
                    id="adviser-review-comment"
                    onChange={(event) => { setComment(event.target.value); setError('') }}
                    placeholder="Provide clear feedback for the organization officer."
                    rows="3"
                    value={comment}
                  />
                  {error && <span className="adviser-form-error" role="alert">{error}</span>}
                </div>
              )}
            </div>
          </div>
        )}
        message=""
        onCancel={() => {
          if (!approvalProcessing) setApprovalConfirmationOpen(false)
        }}
        onConfirm={confirmDecision}
        open={approvalConfirmationOpen}
        title={confirmation.title}
      />
    </>
  )
}
