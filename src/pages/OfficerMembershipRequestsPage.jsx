import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'
import { formatDisplayName } from '../data/displayName.js'

const statusTones = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }
const requestFilters = ['ALL', 'APPROVED', 'REJECTED', 'PENDING']

export default function OfficerMembershipRequestsPage() {
  const {
    approveOfficerMembershipRequest,
    captureUndo,
    officerMembershipRequests,
    rejectOfficerMembershipRequest,
  } = useOutletContext()
  const { showToast } = useToast()
  const [activeFilter, setActiveFilter] = useState('PENDING')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [approveTarget, setApproveTarget] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const pending = officerMembershipRequests.filter((request) => request.status === 'PENDING')
  const visibleRequests = activeFilter === 'ALL'
    ? officerMembershipRequests
    : officerMembershipRequests.filter((request) => request.status === activeFilter)
  const nameOf = formatDisplayName

  function approve() {
    if (!approveTarget) return
    const undo = captureUndo()
    if (approveOfficerMembershipRequest(approveTarget.id)) {
      showToast(`${nameOf(approveTarget)} is now an active member.`, 'success', undoAction(undo))
    }
    setApproveTarget(null)
  }

  function reject() {
    if (!rejectTarget) return
    const undo = captureUndo()
    if (rejectOfficerMembershipRequest(rejectTarget.id, rejectionReason)) {
      showToast(`${nameOf(rejectTarget)}'s application was rejected.`, 'success', undoAction(undo))
    }
    setRejectTarget(null)
    setRejectionReason('')
  }

  function requestList(requests) {
    return (
      <div className="officer-request-history-list">
        {requests.map((request) => (
          <article className="officer-request-history-card" key={request.id}>
            <div className="officer-request-history-avatar" aria-hidden="true">
              {nameOf(request).split(/[ ,]+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('')}
            </div>
            <div className="officer-request-history-info">
              <strong>{nameOf(request)}</strong>
              <span>{request.studentId} <i aria-hidden="true">·</i> {request.program}</span>
            </div>
            <div className="officer-request-history-meta">
              <span>Applied {request.applicationDate}</span>
              {request.status !== 'PENDING' ? (
                <small>
                  {request.status === 'APPROVED' ? 'Approved' : 'Rejected'} {request.decisionDate} · by {request.processedBy ?? 'Organization Officer'}
                  {request.decisionReason && ` · “${request.decisionReason}”`}
                </small>
              ) : (
                <small>{request.organizationName}</small>
              )}
            </div>
            <Badge tone={statusTones[request.status]}>{request.status}</Badge>
            <div className="officer-request-history-actions">
              <Button onClick={() => setSelectedRequest(request)} variant="secondary">View</Button>
              {request.status === 'PENDING' && request.studentId !== 'WMSU-OFFICER-0142' && (
                <>
                  <Button onClick={() => setApproveTarget(request)} variant="primary">Approve</Button>
                  <Button onClick={() => { setRejectTarget(request); setRejectionReason('') }} variant="danger">Reject</Button>
                </>
              )}
              {request.status === 'PENDING' && request.studentId === 'WMSU-OFFICER-0142' && <span className="officer-readonly-label">Cannot process your own application</span>}
            </div>
          </article>
        ))}
        {requests.length === 0 && (
          <p className="officer-inline-empty">
            {activeFilter === 'PENDING'
              ? 'There are no membership requests waiting for review.'
              : 'No membership applications match this filter.'}
          </p>
        )}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        description="Review membership applications for WMSU Computer Society. Decisions affect only your assigned organization."
        eyebrow="WMSU Computer Society"
        title="Membership Requests"
      />
      <Card className="officer-page-card officer-membership-requests-card">
        <div className="officer-request-filter-heading">
          <div><h2>{activeFilter === 'PENDING' ? 'Pending Applications' : activeFilter === 'ALL' ? 'All Applications' : 'Request History'}</h2><p>Review and track membership applications for WMSU Computer Society.</p></div>
          <Badge tone="warning">{pending.length} Pending</Badge>
        </div>
        <div className="officer-request-tabs" role="group" aria-label="Filter membership requests">
          {requestFilters.map((filter) => {
            const count = filter === 'ALL'
              ? officerMembershipRequests.length
              : officerMembershipRequests.filter((request) => request.status === filter).length
            const label = filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()
            return (
              <button
                aria-pressed={activeFilter === filter}
                className={activeFilter === filter ? 'is-selected' : ''}
                key={filter}
                onClick={() => setActiveFilter(filter)}
                type="button"
              >
                {label} <span>{count}</span>
              </button>
            )
          })}
        </div>
        {requestList(visibleRequests)}
      </Card>

      <Modal onClose={() => setSelectedRequest(null)} open={Boolean(selectedRequest)} title="Membership Application">
        {selectedRequest && (
          <div className="officer-request-detail">
            <dl>
              <div><dt>Student</dt><dd>{nameOf(selectedRequest)}</dd></div>
              <div><dt>Student ID</dt><dd>{selectedRequest.studentId}</dd></div>
              <div><dt>Program</dt><dd>{selectedRequest.program}</dd></div>
              <div><dt>Organization</dt><dd>{selectedRequest.organizationName}</dd></div>
              <div><dt>Applied</dt><dd>{selectedRequest.applicationDate}</dd></div>
              <div><dt>Status</dt><dd><Badge tone={statusTones[selectedRequest.status]}>{selectedRequest.status}</Badge></dd></div>
              {selectedRequest.decisionDate && <div><dt>Decision date</dt><dd>{selectedRequest.decisionDate}</dd></div>}
              {selectedRequest.processedBy && <div><dt>Processed by</dt><dd>{selectedRequest.processedBy}</dd></div>}
            </dl>
            <h3>Message / reason</h3>
            <p className="officer-application-message">{selectedRequest.message || 'No application message provided.'}</p>
            {selectedRequest.decisionReason && <p className="officer-permission-note">Decision comment: {selectedRequest.decisionReason}</p>}
          </div>
        )}
        <div className="officer-modal-actions">
          <Button onClick={() => setSelectedRequest(null)} variant="secondary">Close</Button>
          {selectedRequest?.status === 'PENDING' && selectedRequest.studentId !== 'WMSU-OFFICER-0142' && (
            <>
              <Button onClick={() => { setSelectedRequest(null); setApproveTarget(selectedRequest) }} variant="primary">Approve</Button>
              <Button onClick={() => { setSelectedRequest(null); setRejectTarget(selectedRequest); setRejectionReason('') }} variant="secondary">Reject</Button>
            </>
          )}
        </div>
      </Modal>

      <Modal onClose={() => setApproveTarget(null)} open={Boolean(approveTarget)} title="Approve Membership?">
        <p>{approveTarget && nameOf(approveTarget)} will become an active member of {approveTarget?.organizationName}.</p>
        <p className="officer-permission-note">Their position will be set to General Member and the decision will appear in request history.</p>
        <div className="officer-modal-actions">
          <Button onClick={() => setApproveTarget(null)} variant="secondary">Cancel</Button>
          <Button onClick={approve} variant="primary">Approve</Button>
        </div>
      </Modal>

      <Modal onClose={() => { setRejectTarget(null); setRejectionReason('') }} open={Boolean(rejectTarget)} title="Reject Membership Application?">
        <p>Reject {rejectTarget && nameOf(rejectTarget)}&apos;s application to {rejectTarget?.organizationName}?</p>
        <label className="officer-modal-field">
          <span>Optional reason</span>
          <textarea
            className="input"
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Please provide a reason for rejection."
            rows="3"
            value={rejectionReason}
          />
        </label>
        <div className="officer-modal-actions">
          <Button onClick={() => { setRejectTarget(null); setRejectionReason('') }} variant="secondary">Cancel</Button>
          <Button onClick={reject} variant="danger">Reject Application</Button>
        </div>
      </Modal>
    </>
  )
}
