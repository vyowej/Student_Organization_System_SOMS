import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import Card from '../components/ui/Card.jsx'
import Modal from '../components/ui/Modal.jsx'
import ProfileCover from '../components/layout/ProfileCover.jsx'
import { undoAction, useToast } from '../components/ui/useToast.js'
import { officerActivity, officerEventStatuses } from '../data/officerPortal.js'
import { formatDisplayName, formatGreetingName, getTimeGreeting } from '../data/displayName.js'

function MetricIcon({ name }) {
  if (name === 'members') {
    return (
      <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  }
  if (name === 'requests') {
    return (
      <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="8.5" cy="7" r="4" />
        <line x1="20" x2="20" y1="8" y2="14" />
        <line x1="23" x2="17" y1="11" y2="11" />
      </svg>
    )
  }
  if (name === 'events') {
    return (
      <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
        <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" x2="12" y1="18" y2="12" />
      <polyline points="9 15 12 12 15 15" />
    </svg>
  )
}

function ActionIcon({ name }) {
  if (name === 'announcement') {
    return (
      <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
        <path d="m3 11 18-5v12L3 14v-3z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>
    )
  }
  if (name === 'event') {
    return (
      <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
        <rect height="18" rx="2" ry="2" width="18" x="3" y="4" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
        <line x1="12" x2="12" y1="14" y2="18" />
        <line x1="10" x2="14" y1="16" y2="16" />
      </svg>
    )
  }
  if (name === 'members') {
    return (
      <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  }
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" x2="12" y1="18" y2="12" />
      <polyline points="9 15 12 12 15 15" />
    </svg>
  )
}

const metricItems = [
  { key: 'members', label: 'Total Members', tone: 'crimson' },
  { key: 'requests', label: 'Pending Membership Requests', tone: 'blue' },
  { key: 'events', label: 'Upcoming Events', tone: 'gold' },
  { key: 'submissions', label: 'Pending Submissions', tone: 'green' },
]

const dashboardTabs = [
  { key: 'overview', label: 'Overview', to: '/officer/dashboard' },
  { key: 'requests', label: 'Membership Requests', to: '/officer/membership-requests' },
  { key: 'members', label: 'Members', to: '/officer/members' },
  { key: 'events', label: 'Events', to: '/officer/events' },
  { key: 'announcements', label: 'Announcements', to: '/officer/announcements' },
  { key: 'documents', label: 'Documents', to: '/officer/documents' },
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
    captureUndo,
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
    const undo = captureUndo()
    if (!approveOfficerMembershipRequest(request.id)) return
    showToast(`${formatDisplayName(request)} is now an active member.`, 'success', undoAction(undo))
    setRequestToApprove(null)
  }

  function reject() {
    if (!requestToReject) return
    const undo = captureUndo()
    const rejected = rejectOfficerMembershipRequest(requestToReject.id, rejectionReason)
    if (rejected) showToast(`${formatDisplayName(requestToReject)}'s application was rejected.`, 'success', undoAction(undo))
    setRequestToReject(null)
    setRejectionReason('')
  }

  return (
    <div className="officer-dashboard fb-page">
      <ProfileCover
        actions={(
          <>
            <Link className="button button-primary" to="/officer/organization">Manage organization</Link>
            <Link className="button button-secondary" to="/officer/events/create">＋ Create Event</Link>
          </>
        )}
        avatarText={organization?.acronym ?? 'ORG'}
        badges={<Badge tone="crimson">Organization Officer · President</Badge>}
        eyebrow={`${getTimeGreeting()}, ${formatGreetingName(currentUser)}!`}
        label="Your organization"
        logo={organization?.logo}
        showCover={false}
        subtitle="Manage your organization, members, activities, and submissions."
        tabs={dashboardTabs}
        tabsLabel="Officer dashboard sections"
        title={organization?.name ?? 'Your Organization'}
      />

      <div className="fb-body">
        <aside aria-label="Organization overview" className="fb-side">
          <Card className="fb-card">
            <div className="fb-card-heading"><h2>Overview</h2></div>
            <section aria-label="Organization overview metrics" className="fb-metrics">
              {metricItems.map((metric, index) => (
                <div className={`fb-metric fb-metric-${metric.tone}`} key={metric.key}>
                  <span aria-hidden="true" className="fb-metric-icon">
                    <MetricIcon name={metric.key} />
                  </span>
                  <div>
                    <strong className="stat-value">{counts[index]}</strong>
                    <span className="stat-label">{metric.label}</span>
                  </div>
                </div>
              ))}
            </section>
          </Card>
        </aside>

        <div className="fb-feed">
          <Card className="fb-card fb-composer">
            <div className="fb-composer-row">
              <span aria-hidden="true" className="fb-mini-avatar">{(organization?.acronym ?? 'ORG').slice(0, 3)}</span>
              <Link className="fb-composer-input" to="/officer/announcements">What would you like to do today?</Link>
            </div>
            <div aria-label="Quick actions" className="fb-composer-actions fb-composer-actions-4">
              <Link to="/officer/announcements"><ActionIcon name="announcement" /> Post Announcement</Link>
              <Link to="/officer/events/create"><ActionIcon name="event" /> Create Event</Link>
              <Link to="/officer/members"><ActionIcon name="members" /> Manage Members</Link>
              <Link to="/officer/documents"><ActionIcon name="document" /> Upload Document</Link>
            </div>
          </Card>

          <Card className="fb-card officer-requests-panel">
            <div className="fb-card-heading">
              <div>
                <span className="officer-panel-eyebrow">MEMBERSHIP</span>
                <h2>Recent Membership Requests</h2>
              </div>
              <div className="officer-panel-heading-actions">
                <Badge tone={pendingRequests.length ? 'warning' : 'success'}>
                  {pendingRequests.length} awaiting review
                </Badge>
                <Link to="/officer/membership-requests">View all <span aria-hidden="true">→</span></Link>
              </div>
            </div>
            <div className="officer-request-list">
              {pendingRequests.slice(0, 4).map((request) => (
                <article className="officer-request-row" key={request.id}>
                  <div className="officer-request-main">
                    <div className="officer-person-avatar" aria-hidden="true">
                      {formatDisplayName(request).split(/[ ,]+/).map((part) => part[0]).filter(Boolean).slice(0, 2).join('')}
                    </div>
                    <div className="officer-person-copy">
                      <strong>{formatDisplayName(request)}</strong>
                      <span>{request.program} <i aria-hidden="true">·</i> Applied: {request.applicationDate}</span>
                    </div>
                  </div>
                  <div className="officer-request-actions-wrap">
                    <Badge tone="warning">Pending</Badge>
                    <div className="officer-request-actions">
                      <Button onClick={() => setRequestToApprove(request)} variant="primary">Approve</Button>
                      <Button onClick={() => { setRequestToReject(request); setRejectionReason('') }} variant="secondary">Reject</Button>
                      <Button aria-label={`View ${formatDisplayName(request)}'s application`} onClick={() => setSelectedRequest(request)} variant="ghost">View</Button>
                    </div>
                  </div>
                </article>
              ))}
              {pendingRequests.length === 0 && (
                <p className="officer-inline-empty">All membership applications have been reviewed.</p>
              )}
            </div>
          </Card>

          <Card className="fb-card officer-events-panel">
            <div className="fb-card-heading">
              <div>
                <span className="officer-panel-eyebrow">ACTIVITIES</span>
                <h2>Recent Events</h2>
              </div>
              <Link className="officer-org-text-link" to="/officer/events">View events <span aria-hidden="true">→</span></Link>
            </div>
            <div className="officer-event-list">
              {officerEvents.slice(0, 3).map((event) => (
                <article className="officer-event-row" key={event.id}>
                  <span aria-hidden="true" className="officer-event-icon">
                    <MetricIcon name="events" />
                  </span>
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

          <Card className="fb-card">
            <div className="fb-card-heading">
              <div>
                <span className="officer-panel-eyebrow">ORGANIZATION LOG</span>
                <h2>Recent Activity</h2>
              </div>
              <Link className="officer-org-text-link" to="/officer/reports">View reports <span aria-hidden="true">→</span></Link>
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
