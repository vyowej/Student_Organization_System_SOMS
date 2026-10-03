import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import Modal from '../components/ui/Modal.jsx'
import PageHeader from '../components/layout/PageHeader.jsx'
import { useToast } from '../components/ui/useToast.js'
import { officerActivity, officerEventStatuses } from '../data/officerPortal.js'
import { formatDisplayName } from '../data/displayName.js'

const metricItems = [
  { key: 'members', label: 'Total Members', tone: 'crimson', icon: '♧' },
  { key: 'requests', label: 'Pending Membership Requests', tone: 'blue', icon: '＋' },
  { key: 'events', label: 'Upcoming Events', tone: 'gold', icon: '▦' },
  { key: 'submissions', label: 'Pending Submissions', tone: 'green', icon: '◷' },
]

function useCountUp(values) {
  const hasAnimated = useRef(false)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [counts, setCounts] = useState(() => (
    reducedMotion
      ? values
      : values.map(() => 0)
  ))

  useEffect(() => {
    if (reducedMotion) {
      hasAnimated.current = true
      return undefined
    }

    if (hasAnimated.current) {
      setCounts(values)
      return undefined
    }

    let frameId
    const start = performance.now()
    const duration = 850
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - ((1 - progress) ** 3)
      setCounts(values.map((value) => Math.round(value * eased)))
      if (progress < 1) frameId = requestAnimationFrame(tick)
      else hasAnimated.current = true
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [reducedMotion, values])

  return reducedMotion ? values : counts
}

export default function OfficerDashboardPage() {
  const {
    adminOrganizations,
    approveOfficerMembershipRequest,
    officerEvents,
    officerMemberCount,
    officerMembershipRequests,
    officerNotifications,
    rejectOfficerMembershipRequest,
    currentUser,
  } = useOutletContext()
  const organization = adminOrganizations.find((item) => item.id === currentUser?.organizationId)
  const { showToast } = useToast()
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [requestToApprove, setRequestToApprove] = useState(null)
  const [requestToReject, setRequestToReject] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const pendingRequests = officerMembershipRequests.filter((request) => request.status === 'PENDING')
  const metricValues = useMemo(() => [officerMemberCount, pendingRequests.length, 4, 3], [officerMemberCount, pendingRequests.length])
  const counts = useCountUp(metricValues)
  const recentActivity = [
    ...officerNotifications.slice(0, 3).map((notification) => ({
      id: notification.id,
      message: notification.message,
      time: notification.createdAt,
    })),
    ...officerActivity,
  ].slice(0, 5)

  function approve() {
    if (!requestToApprove) return
    const request = requestToApprove
    if (!approveOfficerMembershipRequest(request.id)) return
    showToast(`${formatDisplayName(request)} is now an active member.`, 'success')
    setRequestToApprove(null)
  }

  function reject() {
    if (!requestToReject) return
    const rejected = rejectOfficerMembershipRequest(requestToReject.id, rejectionReason)
    if (rejected) showToast(`${formatDisplayName(requestToReject)}'s application was rejected.`, 'success')
    setRequestToReject(null)
    setRejectionReason('')
  }

  return (
    <div className="officer-dashboard">
      <PageHeader
        description="Manage your organization, members, activities, and submissions."
        eyebrow="Organization Officer"
        title={`Good morning, ${formatDisplayName(currentUser)}!`}
      />

      <section aria-label="Your organization" className="officer-welcome">
        <div className="officer-org-mark" aria-hidden="true">{organization?.acronym ?? 'ORG'}</div>
        <div className="officer-welcome-copy">
          <span>YOUR ORGANIZATION</span>
          <h2>{organization?.name ?? 'Your Organization'}</h2>
          <p>Organization Officer <i aria-hidden="true">·</i> President</p>
        </div>
        <Link className="button button-secondary" to="/officer/organization">Manage organization</Link>
      </section>

      <section aria-label="Organization overview metrics" className="officer-metrics">
        {metricItems.map((metric, index) => (
          <Card className={`officer-metric officer-metric-${metric.tone}`} key={metric.key} style={{ '--officer-index': index }}>
            <span aria-hidden="true" className="officer-metric-icon">{metric.icon}</span>
            <div>
              <strong>{counts[index]}</strong>
              <span>{metric.label}</span>
            </div>
          </Card>
        ))}
      </section>

      <div className="officer-dashboard-grid">
        <Card className="officer-panel officer-requests-panel">
          <div className="officer-panel-heading">
            <div>
              <span className="officer-panel-eyebrow">MEMBERSHIP</span>
              <h2>Recent Membership Requests</h2>
            </div>
            <Link to="/officer/membership-requests">View all <span aria-hidden="true">→</span></Link>
          </div>
          <div className="officer-request-list">
            {pendingRequests.slice(0, 4).map((request) => (
              <article className="officer-request-row" key={request.id}>
                <div className="officer-person-avatar" aria-hidden="true">{formatDisplayName(request).split(/[ ,]+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('')}</div>
                <div className="officer-person-copy">
                  <strong>{formatDisplayName(request)}</strong>
                  <span>{request.program} <i aria-hidden="true">·</i> Applied: {request.applicationDate}</span>
                </div>
                <Badge tone="warning">Pending</Badge>
                <div className="officer-request-actions">
                  <Button onClick={() => setRequestToApprove(request)} variant="primary">Approve</Button>
                  <Button onClick={() => { setRequestToReject(request); setRejectionReason('') }} variant="secondary">Reject</Button>
                  <Button aria-label={`View ${formatDisplayName(request)}'s application`} onClick={() => setSelectedRequest(request)} variant="ghost">View</Button>
                </div>
              </article>
            ))}
            {pendingRequests.length === 0 && (
              <p className="officer-inline-empty">All membership applications have been reviewed.</p>
            )}
          </div>
        </Card>

        <Card className="officer-panel officer-events-panel">
          <div className="officer-panel-heading">
            <div>
              <span className="officer-panel-eyebrow">ACTIVITIES</span>
              <h2>Recent Events</h2>
            </div>
            <Link to="/officer/events">View events <span aria-hidden="true">→</span></Link>
          </div>
          <div className="officer-event-list">
            {officerEvents.slice(0, 3).map((event) => (
              <article className="officer-event-row" key={event.id}>
                <span className="officer-event-icon" aria-hidden="true">▦</span>
                <div className="officer-event-copy">
                  <strong>{event.title}</strong>
                  <span>{event.date} <i aria-hidden="true">·</i> {event.registrations} registrations</span>
                </div>
                <Badge tone={officerEventStatuses[event.status]?.tone ?? 'neutral'}>
                  {officerEventStatuses[event.status]?.label ?? event.status}
                </Badge>
              </article>
            ))}
          </div>
          <div className="officer-panel-actions">
            <Link className="button button-primary" to="/officer/events/create">Create Event</Link>
            <Link className="button button-secondary" to="/officer/events">View Events</Link>
          </div>
        </Card>
      </div>

      <div className="officer-dashboard-grid officer-dashboard-bottom">
        <Card className="officer-panel">
          <div className="officer-panel-heading">
            <div>
              <span className="officer-panel-eyebrow">SHORTCUTS</span>
              <h2>Quick Actions</h2>
            </div>
          </div>
          <div className="officer-quick-actions">
            <Link to="/officer/members"><span aria-hidden="true">♧</span><strong>Manage Members</strong><i aria-hidden="true">→</i></Link>
            <Link to="/officer/events/create"><span aria-hidden="true">＋</span><strong>Create Event</strong><i aria-hidden="true">→</i></Link>
            <Link to="/officer/announcements"><span aria-hidden="true">▤</span><strong>Post Announcement</strong><i aria-hidden="true">→</i></Link>
            <Link to="/officer/documents"><span aria-hidden="true">⇧</span><strong>Upload Document</strong><i aria-hidden="true">→</i></Link>
          </div>
        </Card>
        <Card className="officer-panel">
          <div className="officer-panel-heading">
            <div>
              <span className="officer-panel-eyebrow">ORGANIZATION LOG</span>
              <h2>Recent Activity</h2>
            </div>
            <Link to="/officer/reports">View reports <span aria-hidden="true">→</span></Link>
          </div>
          <ol className="officer-activity-list">
            {recentActivity.map((activity) => (
              <li key={activity.id}>
                <span aria-hidden="true" />
                <div><p>{activity.message}</p><time>{activity.time}</time></div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Modal onClose={() => setSelectedRequest(null)} open={Boolean(selectedRequest)} title="Membership Application">
        {selectedRequest && (
          <div className="officer-request-detail">
            <p><strong>{formatDisplayName(selectedRequest)}</strong></p>
            <p>Student ID: {selectedRequest.studentId}</p>
            <p>Program: {selectedRequest.program}</p>
            <p>Applied: {selectedRequest.applicationDate}</p>
            <p>{selectedRequest.message}</p>
            <Badge tone="warning">Pending review</Badge>
          </div>
        )}
        <div className="officer-modal-actions"><Button onClick={() => setSelectedRequest(null)} variant="secondary">Close</Button></div>
      </Modal>

      <Modal onClose={() => setRequestToApprove(null)} open={Boolean(requestToApprove)} title="Approve Membership?">
        <p>{requestToApprove && formatDisplayName(requestToApprove)} will become an active member of WMSU Computer Society.</p>
        <div className="officer-modal-actions">
          <Button onClick={() => setRequestToApprove(null)} variant="secondary">Cancel</Button>
          <Button onClick={approve} variant="primary">Approve</Button>
        </div>
      </Modal>

      <Modal onClose={() => { setRequestToReject(null); setRejectionReason('') }} open={Boolean(requestToReject)} title="Reject Membership Application?">
        <p>Reject {requestToReject && formatDisplayName(requestToReject)}&apos;s application to WMSU Computer Society?</p>
        <label className="officer-modal-field">
          <span>Optional reason</span>
          <textarea className="input" onChange={(event) => setRejectionReason(event.target.value)} placeholder="Please provide a reason for rejection." rows="3" value={rejectionReason} />
        </label>
        <div className="officer-modal-actions">
          <Button onClick={() => { setRequestToReject(null); setRejectionReason('') }} variant="secondary">Cancel</Button>
          <Button onClick={reject} variant="primary">Reject Application</Button>
        </div>
      </Modal>
    </div>
  )
}
