import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Icon from '../components/ui/Icon.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'
import { formatDisplayName } from '../data/displayName.js'

const statusTones = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }
const requestFilters = ['ALL', 'PENDING', 'APPROVED', 'REJECTED']

export default function OfficerMembershipRequestsPage() {
  const {
    adminOrganizations = [],
    approveOfficerMembershipRequest,
    captureUndo,
    currentUser,
    officerMembershipRequests = [],
    rejectOfficerMembershipRequest,
  } = useOutletContext()
  const { showToast } = useToast()
  const orgId = currentUser?.organizationId || adminOrganizations[0]?.id
  const organization = adminOrganizations?.find((item) => String(item.id) === String(orgId)) || adminOrganizations[0] || { name: 'Your Organization', acronym: 'ORG' }
  const [activeFilter, setActiveFilter] = useState('PENDING')
  const [search, setSearch] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [approveTarget, setApproveTarget] = useState(null)
  const [approvePosition, setApprovePosition] = useState('MEMBER')
  const [approveCustomTitle, setApproveCustomTitle] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const orgRequests = useMemo(
    () => officerMembershipRequests.filter((r) => !organization.id || String(r.organizationId) === String(organization.id)),
    [officerMembershipRequests, organization.id]
  )
  const pending = orgRequests.filter((request) => request.status === 'PENDING')
  const nameOf = formatDisplayName

  const existingPresident = useMemo(() => {
    return (organization?.officers || []).find(
      (o) => (o.rawPosition === 'PRESIDENT' || o.position === 'President') && o.status === 'ACTIVE'
    )
  }, [organization?.officers])

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase()
    return orgRequests
      .filter((request) => activeFilter === 'ALL' || request.status === activeFilter)
      .filter((request) => {
        if (!query) return true
        const text = `${nameOf(request)} ${request.studentId} ${request.program} ${request.applicationDate}`.toLowerCase()
        return text.includes(query)
      })
  }, [activeFilter, orgRequests, search, nameOf])

  async function approve() {
    if (!approveTarget) return
    const isPresident = approvePosition === 'PRESIDENT'
    if (isPresident && existingPresident) {
      showToast(`Error: ${organization.name} already has an active President (${existingPresident.name}). Only one President is allowed.`, 'error')
      return
    }
    const undo = captureUndo()
    const result = await approveOfficerMembershipRequest(approveTarget.id, approvePosition, approveCustomTitle)
    if (result && result.ok !== false) {
      showToast(`${nameOf(approveTarget)} is now an active member.`, 'success', undoAction(undo))
      setApproveTarget(null)
      setApprovePosition('MEMBER')
      setApproveCustomTitle('')
    } else {
      showToast(result?.error || 'Unable to approve membership application.', 'error')
    }
  }

  async function reject() {
    if (!rejectTarget) return
    const undo = captureUndo()
    if (await rejectOfficerMembershipRequest(rejectTarget.id, rejectionReason)) {
      showToast(`${nameOf(rejectTarget)}'s application was rejected.`, 'success', undoAction(undo))
    }
    setRejectTarget(null)
    setRejectionReason('')
  }

  function requestList(requests) {
    if (requests.length === 0) {
      return (
        <EmptyState
          title={search ? 'No matching applications' : activeFilter === 'PENDING' ? 'No pending applications' : 'No membership applications'}
          description={search ? 'Try adjusting your search keywords.' : activeFilter === 'PENDING' ? 'All student membership requests have been processed.' : 'No applications found in this category.'}
        />
      )
    }

    return (
      <div className="officer-request-history-list">
        {requests.map((request) => (
          <article className="officer-request-history-card" key={request.id}>
            <div className="officer-request-history-avatar" aria-hidden="true">
              {nameOf(request).split(/[ ,]+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="officer-request-history-info">
              <strong>{nameOf(request)}</strong>
              <span>{request.studentId} <i aria-hidden="true">·</i> {request.program}</span>
            </div>
            <div className="officer-request-history-meta">
              <span>Applied {request.applicationDate}</span>
              {request.status !== 'PENDING' ? (
                <small>
                  {request.status === 'APPROVED' ? 'Approved' : 'Rejected'} {request.decisionDate} · by {request.processedBy || 'Organization Officer'}
                  {request.decisionReason && ` · “${request.decisionReason}”`}
                </small>
              ) : (
                <small>{request.organizationName || organization.name}</small>
              )}
            </div>
            <Badge tone={statusTones[request.status]}>{request.status}</Badge>
            <div className="officer-request-history-actions">
              <Button onClick={() => setSelectedRequest(request)} variant="secondary">View</Button>
              {request.status === 'PENDING' && String(request.studentId) !== String(currentUser?.studentId) && (
                <>
                  <Button onClick={() => setApproveTarget(request)} variant="primary">Approve</Button>
                  <Button onClick={() => { setRejectTarget(request); setRejectionReason('') }} variant="danger">Reject</Button>
                </>
              )}
              {request.status === 'PENDING' && String(request.studentId) === String(currentUser?.studentId) && <span className="officer-readonly-label">Cannot process your own application</span>}
            </div>
          </article>
        ))}
      </div>
    )
  }

  return (
    <div className="officer-page">
      <PageHeader
        description={`Review membership applications for ${organization.name}. Decisions affect only your assigned organization.`}
        eyebrow={organization.name}
        title="Membership Requests"
      />
      <Card className="officer-page-card officer-membership-requests-card">
        <div className="officer-request-filter-heading">
          <div>
            <h2>{activeFilter === 'PENDING' ? 'Pending Applications' : activeFilter === 'ALL' ? 'All Applications' : 'Request History'}</h2>
            <p>Review and track membership applications for {organization.name}.</p>
          </div>
          <Badge tone="warning">{pending.length} Pending</Badge>
        </div>

        <div className="officer-toolbar-tabs-row officer-announcements-toolbar" style={{ marginTop: '4px', marginBottom: '16px' }}>
          <div className="officer-request-tabs" role="group" aria-label="Filter membership requests">
            {requestFilters.map((filter) => {
              const count = filter === 'ALL'
                ? orgRequests.length
                : orgRequests.filter((request) => request.status === filter).length
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
          <label className="officer-member-search" style={{ margin: 0, minWidth: '220px' }}>
            <span className="sr-only">Search applicants by name, student ID, or program</span>
            <Icon name="search" size={16} />
            <input onChange={(event) => setSearch(event.target.value)} placeholder="Search applicants..." type="search" value={search} />
          </label>
        </div>

        {requestList(visibleRequests)}
      </Card>

      <Modal onClose={() => setSelectedRequest(null)} open={Boolean(selectedRequest)} size="md" title="Membership Application">
        {selectedRequest && (
          <div className="officer-request-detail">
            <dl>
              <div><dt>Student</dt><dd>{nameOf(selectedRequest)}</dd></div>
              <div><dt>Student ID</dt><dd>{selectedRequest.studentId}</dd></div>
              <div><dt>Program</dt><dd>{selectedRequest.program}</dd></div>
              <div><dt>Organization</dt><dd>{selectedRequest.organizationName || organization.name}</dd></div>
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
          {selectedRequest?.status === 'PENDING' && String(selectedRequest.studentId) !== String(currentUser?.studentId) && (
            <>
              <Button onClick={() => { setSelectedRequest(null); setApproveTarget(selectedRequest) }} variant="primary">Approve</Button>
              <Button onClick={() => { setSelectedRequest(null); setRejectTarget(selectedRequest); setRejectionReason('') }} variant="secondary">Reject</Button>
            </>
          )}
        </div>
      </Modal>

      <Modal onClose={() => { setApproveTarget(null); setApprovePosition('MEMBER'); setApproveCustomTitle('') }} open={Boolean(approveTarget)} size="md" title="Approve Membership?">
        <p>{approveTarget && nameOf(approveTarget)} will become an active member of {approveTarget?.organizationName || organization.name}.</p>
        <div style={{ marginTop: '14px', marginBottom: '16px', display: 'grid', gap: '8px' }}>
          <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
            Assign Organization Position *
            <select
              className="input"
              value={approvePosition}
              onChange={(e) => setApprovePosition(e.target.value)}
              style={{ minHeight: '38px', padding: '7px 11px', borderRadius: '8px' }}
            >
              <option value="MEMBER">General Member</option>
              <option value="PRESIDENT" disabled={Boolean(existingPresident)}>
                President {existingPresident ? `(Occupied: ${existingPresident.name})` : ''}
              </option>
              <option value="VICE_PRESIDENT">Vice President</option>
              <option value="SECRETARY">Secretary</option>
              <option value="TREASURER">Treasurer</option>
              <option value="AUDITOR">Auditor</option>
              <option value="PRO">Public Relations Officer (PRO)</option>
              <option value="OTHER_OFFICER">Other Officer Position</option>
            </select>
          </label>
          {approvePosition === 'PRESIDENT' && existingPresident && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #f87171',
                color: '#991b1b',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
              }}
            >
              <strong>Error: President position already occupied</strong>
              <p style={{ margin: '4px 0 0' }}>
                {organization.name} already has an active President (<b>{existingPresident.name}</b>). You cannot assign another President.
              </p>
            </div>
          )}
          {approvePosition === 'OTHER_OFFICER' && (
            <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
              Custom Officer Title *
              <input
                className="input"
                type="text"
                placeholder="e.g. Committee Head"
                value={approveCustomTitle}
                onChange={(e) => setApproveCustomTitle(e.target.value)}
                style={{ minHeight: '38px', padding: '7px 11px', borderRadius: '8px' }}
              />
            </label>
          )}
        </div>
        <div className="officer-modal-actions">
          <Button onClick={() => { setApproveTarget(null); setApprovePosition('MEMBER'); setApproveCustomTitle('') }} variant="secondary">Cancel</Button>
          <Button disabled={approvePosition === 'PRESIDENT' && Boolean(existingPresident)} onClick={approve} variant="primary">Approve Member</Button>
        </div>
      </Modal>

      <Modal onClose={() => { setRejectTarget(null); setRejectionReason('') }} open={Boolean(rejectTarget)} size="sm" title="Reject Membership Application?">
        <p>Reject {rejectTarget && nameOf(rejectTarget)}&apos;s application to {rejectTarget?.organizationName || organization.name}?</p>
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
    </div>
  )
}
