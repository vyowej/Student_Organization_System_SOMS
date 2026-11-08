import { useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import EmptyState from '../components/ui/EmptyState.jsx'
import Icon from '../components/ui/Icon.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { useToast } from '../components/ui/useToast.js'
import { formatDisplayName } from '../data/displayName.js'
import {
  OFFICER_HIERARCHY,
  ORGANIZATION_COMMITTEES,
  getHierarchyEntry,
} from '../data/officerHierarchy.js'

const statusTones = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' }
const requestFilters = ['ALL', 'PENDING', 'APPROVED', 'REJECTED']

export default function OfficerMembershipRequestsPage() {
  const {
    adminOrganizations = [],
    approveOfficerMembershipRequest,
    currentUser,
    officerMembershipRequests = [],
    rejectOfficerMembershipRequest,
  } = useOutletContext()
  const { showToast } = useToast()
  const orgId = currentUser?.organizationId || adminOrganizations[0]?.id
  const organization =
    adminOrganizations?.find((item) => String(item.id) === String(orgId)) ||
    adminOrganizations[0] || { name: 'Your Organization', acronym: 'ORG' }

  const [activeFilter, setActiveFilter] = useState('PENDING')
  const [search, setSearch] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [approveTarget, setApproveTarget] = useState(null)
  const [approvePosition, setApprovePosition] = useState('OTHER_OFFICER')
  const [approveCommittee, setApproveCommittee] = useState('Programs & Events Committee')
  const [approveCustomTitle, setApproveCustomTitle] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const orgRequests = useMemo(
    () =>
      officerMembershipRequests.filter(
        (r) => !organization.id || String(r.organizationId) === String(organization.id)
      ),
    [officerMembershipRequests, organization.id]
  )
  const pending = orgRequests.filter((request) => request.status === 'PENDING')
  const nameOf = formatDisplayName

  const existingPresident = useMemo(
    () =>
      (organization?.officers || []).find(
        (o) =>
          (o.rawPosition === 'PRESIDENT' || o.position === 'President') &&
          o.status === 'ACTIVE'
      ),
    [organization?.officers]
  )

  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase()
    return orgRequests
      .filter((request) => activeFilter === 'ALL' || request.status === activeFilter)
      .filter((request) => {
        if (!query) return true
        const text = `${nameOf(request)} ${request.studentId} ${request.program} ${request.applicationDate} ${request.corFileName || ''}`.toLowerCase()
        return text.includes(query)
      })
  }, [activeFilter, orgRequests, search, nameOf])

  async function approve() {
    if (!approveTarget) return
    const isPresident = approvePosition === 'PRESIDENT'
    if (isPresident && existingPresident) {
      showToast(
        `Error: ${organization.name} already has an active President (${existingPresident.name}). Only one President is allowed.`,
        'error'
      )
      return
    }
    const result = await approveOfficerMembershipRequest(
      approveTarget.id,
      approvePosition,
      approvePosition === 'OTHER_OFFICER' ? approveCustomTitle : '',
      approveCommittee
    )
    if (result && result.ok !== false) {
      const entry = getHierarchyEntry(approvePosition)
      showToast(
        `${nameOf(approveTarget)} approved as ${entry.title} (${approveCommittee}).`,
        'success'
      )
      setApproveTarget(null)
      setApprovePosition('OTHER_OFFICER')
      setApproveCommittee('Programs & Events Committee')
      setApproveCustomTitle('')
    } else {
      showToast(result?.error || 'Unable to approve officer onboarding request.', 'error')
    }
  }

  async function reject() {
    if (!rejectTarget) return
    if (await rejectOfficerMembershipRequest(rejectTarget.id, rejectionReason)) {
      showToast(`${nameOf(rejectTarget)}'s application was rejected.`, 'success')
    }
    setRejectTarget(null)
    setRejectionReason('')
  }

  function requestList(requests) {
    if (requests.length === 0) {
      return (
        <EmptyState
          description={
            search
              ? 'Try adjusting your search keywords.'
              : activeFilter === 'PENDING'
                ? 'All officer onboarding applications have been processed.'
                : 'No applications found in this category.'
          }
          title={
            search
              ? 'No matching applications'
              : activeFilter === 'PENDING'
                ? 'No pending applications'
                : 'No applications'
          }
        />
      )
    }

    return (
      <div className="officer-request-history-list">
        {requests.map((request) => (
          <article className="officer-request-history-card" key={request.id}>
            <div aria-hidden="true" className="officer-request-history-avatar">
              {nameOf(request)
                .split(/[ ,]+/)
                .map((part) => part[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>
            <div className="officer-request-history-info">
              <strong>{nameOf(request)}</strong>
              <span>
                {request.studentId} <i aria-hidden="true">·</i> {request.program}
                {request.corFileName && (
                  <>
                    {' '}
                    <i aria-hidden="true">·</i> COR: {request.corFileName}
                  </>
                )}
              </span>
            </div>
            <div className="officer-request-history-meta">
              <span>Applied {request.applicationDate}</span>
              {request.status !== 'PENDING' ? (
                <small>
                  {request.status === 'APPROVED' ? 'Approved' : 'Rejected'} {request.decisionDate} · by{' '}
                  {request.processedBy || 'Organization Officer'}
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
                  <Button
                    onClick={() => {
                      setApproveTarget(request)
                      setApprovePosition('OTHER_OFFICER')
                      setApproveCommittee('Programs & Events Committee')
                    }}
                    variant="primary"
                  >
                    Approve
                  </Button>
                  <Button
                    onClick={() => {
                      setRejectTarget(request)
                      setRejectionReason('')
                    }}
                    variant="danger"
                  >
                    Reject
                  </Button>
                </>
              )}
              {request.status === 'PENDING' && String(request.studentId) === String(currentUser?.studentId) && (
                <span className="officer-readonly-label">Cannot process your own application</span>
              )}
            </div>
          </article>
        ))}
      </div>
    )
  }

  return (
    <div className="officer-page">
      <PageHeader
        description={`Review officer & committee applications for ${organization.name}. Verify uploaded COR files and assign hierarchy roles.`}
        eyebrow={organization.name}
        title="Officer Onboarding Requests"
      />
      <Card className="officer-page-card officer-membership-requests-card">
        <div className="officer-request-filter-heading">
          <div>
            <h2>
              {activeFilter === 'PENDING'
                ? 'Pending Applications'
                : activeFilter === 'ALL'
                  ? 'All Applications'
                  : 'Request History'}
            </h2>
            <p>Review and track officer applications and COR attachments for {organization.name}.</p>
          </div>
          <Badge tone="warning">{pending.length} Pending</Badge>
        </div>

        <div className="officer-toolbar-tabs-row officer-announcements-toolbar" style={{ marginTop: '4px', marginBottom: '16px' }}>
          <div aria-label="Filter applications" className="officer-request-tabs" role="group">
            {requestFilters.map((filter) => {
              const count =
                filter === 'ALL'
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
            <span className="sr-only">Search applicants by name, numeric ID, or program</span>
            <Icon name="search" size={16} />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search applicants..."
              type="search"
              value={search}
            />
          </label>
        </div>

        {requestList(visibleRequests)}
      </Card>

      <Modal
        onClose={() => setSelectedRequest(null)}
        open={Boolean(selectedRequest)}
        size="md"
        status={selectedRequest?.status}
        title="Officer Application Details"
      >
        {selectedRequest && (
          <div className="officer-request-detail">
            <dl>
              <div><dt>Applicant</dt><dd>{nameOf(selectedRequest)}</dd></div>
              <div><dt>Student ID</dt><dd>{selectedRequest.studentId}</dd></div>
              <div><dt>Course / Program</dt><dd>{selectedRequest.program}</dd></div>
              <div><dt>Organization</dt><dd>{selectedRequest.organizationName || organization.name}</dd></div>
              <div><dt>Certificate of Registration (COR)</dt><dd>{selectedRequest.corFileName || 'On institutional file'}</dd></div>
              <div><dt>Applied</dt><dd>{selectedRequest.applicationDate}</dd></div>
              <div><dt>Status</dt><dd><Badge tone={statusTones[selectedRequest.status]}>{selectedRequest.status}</Badge></dd></div>
              {selectedRequest.decisionDate && <div><dt>Decision Date</dt><dd>{selectedRequest.decisionDate}</dd></div>}
              {selectedRequest.processedBy && <div><dt>Processed By</dt><dd>{selectedRequest.processedBy}</dd></div>}
            </dl>
            <h3>Application Message</h3>
            <p className="officer-application-message">{selectedRequest.message || 'No application message provided.'}</p>
            {selectedRequest.decisionReason && <p className="officer-permission-note">Decision comment: {selectedRequest.decisionReason}</p>}
          </div>
        )}
        <div className="officer-modal-actions">
          <Button onClick={() => setSelectedRequest(null)} variant="secondary">Close</Button>
          {selectedRequest?.status === 'PENDING' && String(selectedRequest.studentId) !== String(currentUser?.studentId) && (
            <>
              <Button
                onClick={() => {
                  const target = selectedRequest
                  setSelectedRequest(null)
                  setApproveTarget(target)
                }}
                variant="primary"
              >
                Approve
              </Button>
              <Button
                onClick={() => {
                  const target = selectedRequest
                  setSelectedRequest(null)
                  setRejectTarget(target)
                  setRejectionReason('')
                }}
                variant="danger"
              >
                Reject
              </Button>
            </>
          )}
        </div>
      </Modal>

      <Modal
        onClose={() => {
          setApproveTarget(null)
          setApprovePosition('OTHER_OFFICER')
          setApproveCommittee('Programs & Events Committee')
          setApproveCustomTitle('')
        }}
        open={Boolean(approveTarget)}
        size="md"
        title="Approve Officer & Assign Committee"
        tone="success"
      >
        <p>
          <strong>{approveTarget && nameOf(approveTarget)}</strong> will become an active officer of{' '}
          <b>{approveTarget?.organizationName || organization.name}</b>.
        </p>
        <div style={{ marginTop: '14px', marginBottom: '16px', display: 'grid', gap: '10px' }}>
          <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
            <span>Officer Hierarchy Position <span className="required-asterisk">*</span></span>
            <select
              className="input"
              onChange={(e) => {
                const code = e.target.value
                setApprovePosition(code)
                setApproveCommittee(getHierarchyEntry(code).defaultCommittee)
              }}
              style={{ minHeight: '38px', padding: '7px 11px', borderRadius: '8px' }}
              value={approvePosition}
            >
              {OFFICER_HIERARCHY.map((role) => (
                <option
                  disabled={role.code === 'PRESIDENT' && Boolean(existingPresident)}
                  key={role.code}
                  value={role.code}
                >
                  Rank {role.rank}: {role.title}
                  {role.code === 'PRESIDENT' && existingPresident ? ` (Occupied: ${existingPresident.name})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
            <span>Assigned Standing Committee <span className="required-asterisk">*</span></span>
            <select
              className="input"
              onChange={(e) => setApproveCommittee(e.target.value)}
              style={{ minHeight: '38px', padding: '7px 11px', borderRadius: '8px' }}
              value={approveCommittee}
            >
              {ORGANIZATION_COMMITTEES.map((committee) => (
                <option key={committee} value={committee}>{committee}</option>
              ))}
            </select>
          </label>

          {approvePosition === 'OTHER_OFFICER' && (
            <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 600 }}>
              <span>Specific Chairperson Title (optional)</span>
              <input
                className="input"
                onChange={(e) => setApproveCustomTitle(e.target.value)}
                placeholder="e.g., Programs & Events Chairperson"
                style={{ minHeight: '38px', padding: '7px 11px', borderRadius: '8px' }}
                type="text"
                value={approveCustomTitle}
              />
            </label>
          )}
        </div>
        <div className="officer-modal-actions">
          <Button
            onClick={() => {
              setApproveTarget(null)
              setApprovePosition('OTHER_OFFICER')
              setApproveCommittee('Programs & Events Committee')
              setApproveCustomTitle('')
            }}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            disabled={approvePosition === 'PRESIDENT' && Boolean(existingPresident)}
            onClick={approve}
            variant="primary"
          >
            Approve &amp; Assign Role
          </Button>
        </div>
      </Modal>

      <Modal
        onClose={() => {
          setRejectTarget(null)
          setRejectionReason('')
        }}
        open={Boolean(rejectTarget)}
        size="sm"
        title="Reject Officer Application"
        tone="danger"
      >
        <p>
          Reject <strong>{rejectTarget && nameOf(rejectTarget)}</strong>&apos;s application to{' '}
          <b>{rejectTarget?.organizationName || organization.name}</b>?
        </p>
        <label className="officer-modal-field">
          <span>Reason / Remarks</span>
          <textarea
            className="input"
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Provide reason for rejection."
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
