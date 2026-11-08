import { useState } from 'react'
import Badge from '../ui/Badge.jsx'
import Button from '../ui/Button.jsx'
import ConfirmDialog from '../ui/ConfirmDialog.jsx'
import Modal from '../ui/Modal.jsx'
import Icon from '../ui/Icon.jsx'
import {
  OFFICER_HIERARCHY,
  ORGANIZATION_COMMITTEES,
  getHierarchyEntry,
} from '../../data/officerHierarchy.js'

const statusTone = {
  PENDING: 'warning',
  SUBMITTED: 'warning',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  PUBLISHED: 'success',
  VERIFIED: 'success',
  RETURNED: 'danger',
  RETURNED_FOR_REVISION: 'danger',
  REJECTED: 'danger',
  CANCELLED: 'danger',
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
  const [assignedPosition, setAssignedPosition] = useState('OTHER_OFFICER')
  const [assignedCommittee, setAssignedCommittee] = useState('Programs & Events Committee')
  const [customTitle, setCustomTitle] = useState('')

  function close() {
    setDecision('')
    setComment('')
    setError('')
    setAssignedPosition('OTHER_OFFICER')
    setAssignedCommittee('Programs & Events Committee')
    setCustomTitle('')
    setApprovalConfirmationOpen(false)
    setApprovalProcessing(false)
    onClose()
  }

  function requestDecision(nextDecision) {
    setDecision(nextDecision)
    setError('')
    setApprovalConfirmationOpen(true)
  }

  async function confirmDecision() {
    if (approvalProcessing) return
    if (decision === 'RETURNED' || decision === 'REJECTED') {
      if (!comment.trim()) {
        setError(decision === 'REJECTED' ? 'Enter a reason before rejecting this submission.' : 'Enter revision comments before returning this submission.')
        return
      }
    }
    setApprovalProcessing(true)
    const saved = await onDecision(decision, comment, assignedPosition, customTitle, assignedCommittee)
    if (saved) close()
    else setApprovalProcessing(false)
  }

  async function handleOpenComplianceFile() {
    const rawId = String(item?.eventId || item?.id || '').replace(/^EVT-|^APR-EVT-/i, '')
    if (!rawId) return
    try {
      const apiBase = import.meta.env.VITE_API_URL || '/api'
      const res = await fetch(`${apiBase}/events/${rawId}/compliance-file`)
      if (!res.ok) return
      const payload = await res.json()
      if (payload?.compliance_file_data) {
        const link = document.createElement('a')
        link.href = payload.compliance_file_data
        link.download = payload.compliance_file_name || 'compliance-document'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch {
      // Ignore if file bytes are not stored
    }
  }

  function confirmationCopy() {
    if (item?.type === 'MEMBERSHIP_APPLICATION') {
      if (decision === 'APPROVED') {
        const roleLabel = assignedPosition === 'OTHER_OFFICER'
          ? (customTitle || 'Committee Chairperson')
          : getHierarchyEntry(assignedPosition).title
        return {
          title: 'Confirm Officer / Committee Approval',
          message: `Approve ${item.name || item.submittedBy || 'this applicant'} into ${item.organizationName} as ${roleLabel} (${assignedCommittee})?`,
          label: 'Yes, Approve & Assign',
          icon: '✓',
          tone: 'success',
        }
      }
      if (decision === 'REJECTED') {
        return {
          title: 'Confirm Application Rejection',
          message: `Reject ${item.name || item.submittedBy || 'this applicant'}'s application to ${item.organizationName}?`,
          label: 'Yes, Reject',
          icon: '!',
          tone: 'danger',
        }
      }
    }
    if (decision === 'APPROVED') {
      return {
        title: approvalConfirmationTitle,
        message: approvalConfirmationMessage,
        label: approvalConfirmationLabel,
        icon: '✓',
        tone: 'success',
      }
    }
    if (decision === 'VERIFIED') {
      return {
        title: 'Confirm Report Verification',
        message: 'Are you sure you want to verify this accomplishment report? Please make sure you have reviewed all the report details and supporting documents before proceeding.',
        label: 'Yes, Verify Report',
        icon: '✓',
        tone: 'success',
      }
    }
    if (decision === 'REJECTED') {
      return {
        title: 'Confirm Rejection',
        message: 'Are you sure you want to reject this request? Please review the details and provide a reason before proceeding.',
        label: 'Yes, Reject',
        icon: '!',
        tone: 'danger',
      }
    }
    return {
      title: 'Confirm Return for Revision',
      message: 'Are you sure you want to return this request for revision? Please review the details and provide feedback before proceeding.',
      label: 'Yes, Return for Revision',
      icon: '!',
      tone: 'warning',
    }
  }

  const confirmation = confirmationCopy()
  const complianceDocuments = (() => {
    if (!item) return []
    const list = []
    if (item.complianceFileName) {
      list.push(item.complianceFileName)
    }
    if (Array.isArray(item.supportingDocuments)) {
      for (const doc of item.supportingDocuments) {
        const docName = typeof doc === 'string' ? doc : (doc?.name || doc?.title || '')
        if (docName && !list.includes(docName)) {
          list.push(docName)
        }
      }
    }
    return list
  })()

  return (
    <>
      <Modal
        onClose={close}
        open={Boolean(item)}
        size={report ? 'xl' : 'lg'}
        status={item?.status}
        title={report ? 'Accomplishment Report' : 'Submission Review'}
      >
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
                    ['Registered', turnout?.registered ?? item.registeredCount ?? item.registered],
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
                <h4>Compliance & Supporting Documents</h4>
                {complianceDocuments.length > 0 ? (
                  <div className="adviser-report-files">
                    {complianceDocuments.map((fileName, index) => (
                      <div className="adviser-report-file-card" key={`${fileName}-${index}`}>
                        <Icon name="document" size={16} />
                        <span>
                          <strong>{fileName}</strong>
                          <small>{index === 0 && item.complianceFileName ? 'Uploaded compliance document' : 'Supporting document'}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No supporting documents attached.</p>
                )}
              </section>
              {item.status === 'VERIFIED' && (
                <section className="adviser-report-verification">
                  <strong><Icon name="check-circle" size={16} style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: '4px' }} /> Verified</strong>
                  <p>Verified by <b>{item.verifiedBy ?? verifiedBy ?? 'Assigned adviser'}</b></p>
                  <p>Verified on <b>{item.decisionDate ?? 'Date not recorded'}</b></p>
                </section>
              )}
            </>
          ) : item.type === 'MEMBERSHIP_APPLICATION' ? (
            <>
              <dl className="adviser-review-facts">
                <div><dt>Applicant</dt><dd>{item.name ?? item.submittedBy ?? 'Officer Applicant'}</dd></div>
                <div><dt>Student ID</dt><dd>{item.studentId ?? 'Not recorded'}</dd></div>
                <div><dt>Program</dt><dd>{item.program ?? 'Not recorded'}</dd></div>
                {item.yearLevel && <div><dt>Year Level</dt><dd>{item.yearLevel}</dd></div>}
                <div><dt>Organization</dt><dd>{item.organizationName ?? 'Campus Organization'}</dd></div>
                <div><dt>COR Document</dt><dd>{item.corFileName || 'Verified on profile'}</dd></div>
                <div><dt>Date Applied</dt><dd>{item.submittedDate ?? item.applicationDate ?? 'Not recorded'}</dd></div>
                {item.decisionDate && <div><dt>Decision Date</dt><dd>{item.decisionDate}</dd></div>}
              </dl>
              <section>
                <h4>Application message / notes</h4>
                <p>{item.reason || item.message || 'No additional message was provided with this application.'}</p>
              </section>
              {item.status === 'PENDING' && (
                <section style={{ marginTop: '16px', padding: '14px', borderRadius: '10px', background: '#faf8f9', border: '1px solid #ebdbe2' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: '#74102d' }}>Assign Officer Role & Committee</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                    <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#49434a' }}>
                      Officer Hierarchy Position *
                      <select
                        value={assignedPosition}
                        onChange={(e) => {
                          const nextCode = e.target.value
                          setAssignedPosition(nextCode)
                          setAssignedCommittee(getHierarchyEntry(nextCode).defaultCommittee)
                        }}
                        style={{ minHeight: '38px', padding: '7px 11px', borderRadius: '8px', border: '1px solid #d9d2d7', background: 'white' }}
                      >
                        {OFFICER_HIERARCHY.map((entry) => (
                          <option key={entry.code} value={entry.code}>
                            {entry.title} ({entry.tierLabel})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#49434a' }}>
                      Assigned Committee *
                      <select
                        value={assignedCommittee}
                        onChange={(e) => setAssignedCommittee(e.target.value)}
                        style={{ minHeight: '38px', padding: '7px 11px', borderRadius: '8px', border: '1px solid #d9d2d7', background: 'white' }}
                      >
                        {ORGANIZATION_COMMITTEES.map((comm) => (
                          <option key={comm} value={comm}>{comm}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {assignedPosition === 'OTHER_OFFICER' && (
                    <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#49434a', marginTop: '10px' }}>
                      Specific Officer / Chairperson Title
                      <input
                        type="text"
                        placeholder="e.g. Programs & Events Chairperson"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        style={{ minHeight: '38px', padding: '7px 11px', borderRadius: '8px', border: '1px solid #d9d2d7', background: 'white' }}
                      />
                    </label>
                  )}
                </section>
              )}
            </>
          ) : (
            <>
              <dl className="adviser-review-facts">
                <div><dt>Request type</dt><dd>{item.type?.replaceAll('_', ' ') ?? 'EVENT'}</dd></div>
                <div><dt>Submitted by</dt><dd>{item.submittedBy ?? 'Organization Officer'}</dd></div>
                <div><dt>Submitted</dt><dd>{item.submittedDate ?? item.submissionDate ?? 'Not recorded'}</dd></div>
                {(item.eventDate || item.date) && <div><dt>Event date</dt><dd>{item.eventDate || item.date}</dd></div>}
                {item.time && <div><dt>Time</dt><dd>{item.time}</dd></div>}
                {(item.venue || item.location) && <div><dt>Venue</dt><dd>{item.venue ?? item.location}</dd></div>}
                {item.targetAudience && <div><dt>Target audience</dt><dd>{item.targetAudience}</dd></div>}
                {item.attendance !== undefined && <div><dt>Attendance</dt><dd>{item.attendance}</dd></div>}
                {item.capacity !== undefined && <div><dt>Max Participants</dt><dd>{item.capacity || 'Open capacity'}</dd></div>}
                {item.registrationDeadline && <div><dt>Registration deadline</dt><dd>{item.registrationDeadline}</dd></div>}
                {item.budget && <div><dt>Budget</dt><dd>{item.budget}</dd></div>}
                {item.adviserDecisionDate && <div><dt>Decision date</dt><dd>{item.adviserDecisionDate}</dd></div>}
              </dl>
              <section><h4>Description</h4><p>{item.description ?? 'No description was provided.'}</p></section>
              <section>
                <h4>Compliance & Supporting Documents</h4>
                {complianceDocuments.length > 0 ? (
                  <div className="adviser-report-files">
                    {complianceDocuments.map((fileName, idx) => (
                      <div className="adviser-report-file-card" key={`${fileName}-${idx}`}>
                        <Icon name="document" size={16} />
                        <span style={{ flex: 1 }}>
                          <strong>{fileName}</strong>
                          <small>{idx === 0 ? 'Uploaded compliance document' : 'Supporting attachment'}</small>
                        </span>
                        {idx === 0 && item.hasComplianceFile && (
                          <Button onClick={handleOpenComplianceFile} size="sm" variant="secondary">
                            Download
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No compliance document attached.</p>
                )}
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
                ) : item.type === 'MEMBERSHIP_APPLICATION' ? (
                  <>
                    <Button onClick={() => requestDecision('REJECTED')} variant="danger">Reject Application</Button>
                    <Button onClick={() => requestDecision('APPROVED')} variant="primary">Approve & Assign Role</Button>
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
        tone={confirmation.tone}
      />
    </>
  )
}
